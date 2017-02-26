"use strict";
var orange = (function(){
  var srcHashCode; //
  var itemArray = [];
  var hashCode = function(s){
    return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
  }
  function setItemArray(src){
    srcHashCode = hashCode(src);
    var includeHead = false, no = 0;
    src.split('\n').forEach(function(line){
        var fields = line.split('\t');
        if(fields[0].toUpperCase() === 'NAME' && fields[1].toUpperCase() === 'TYPE') {
          includeHead = true; return true;
        }
        var columnName, dataType, isPK, comment, property;
        if(fields.length === 4 ){
          columnName = fields[0].toUpperCase();
          dataType = fields[1].toUpperCase();
          isPK = true;
          comment = fields[3].trim();
        }else if( fields.length === 3 ){
          columnName = fields[0].trim().toUpperCase();
          dataType = fields[1].trim().toUpperCase();
          isPK = false;
          comment = fields[2].trim();
        }else{
          return true;
        }
        property = toPropery(columnName);
        no++;
        itemArray.push({
          columnName : columnName,
          dataType : dataType ,
          isPK  : isPK,
          comment : comment,
          no : no,
          property : property
        });
    });
  }
  var toPropery = function(columnName){
    if(columnName === null || columnName === undefined ) return '';
    var ss = columnName.split('_'), r = '';
    for(var i=0; i < ss.length; i++){
      if( i === 0){
          r += ss[i].toLowerCase();
      }else {
          r += ss[i].substring(0, 1).toUpperCase() + ss[i].substring(1).toLowerCase();
      }
    }
    return r;
  }
  var extract = function(s, start, end){
     var pos1 = s.indexOf('('), pos2 = s.indexOf(')');
     if(pos1 > -1 && pos2 > -1 && pos2 > pos1){
       return s.substring(pos1+1, pos2);
     }
     return '';
  }
  var getSize = function(dataType){
     if(dataType === null || dataType === undefined ) return '';
     if(dataType.indexOf('CHAR') > -1){
        return '@Size(max = ' + extract(dataType, '(',')') + ')\n';
     }else if(dataType.indexOf('DATE') > -1 || dataType.indexOf('TIMESTAMP') > -1){
        return '@DateTimeFormat(pattern = "yyyy-MM-dd")';
     }else{
        return '';
     }
  }
  var format = function(){
    var args = Array.prototype.slice.call(arguments, 1);
    var f = arguments[0];
    return f.replace(/{(\d+)}/g, function(match, number){
      return typeof args[number] != 'undefined' ? args[number] : match;
    });
  }
  //src에  format f를 적용해서 문자열을 리턴한다.
  var applyFormat=function(src, f ){
      var trimmedSrc = trim(src);
      if(hashCode(trimmedSrc) !== srcHashCode){
        setItemArray(trimmedSrc);
      }
      var r = '';
      itemArray.forEach(function(fields){
        var property = toPropery(fields.columnName);
        r += format(f, fields.no, fields.columnName, fields.property, fields.comment)+'\n';
      });
      return r.trim();
  }
  var getTablePrefix = function(tableName){
    if(tableName === '' || startsWith(tableName, 'xxx') ){
       return '';
     }else {
       return tableName.substring(0, 6).toUpperCase() + '.';
     }
  }
  var removeFirst = function(src, ch, replaceCh){
    var pos = src.indexOf(ch), des = src, replaceCh = replaceCh || ' ';
    if(pos > -1){
        des = replaceCh + src.substring(pos+1);
    }
    return des;
  }
  var pad = function(str, len, chr, leftJustify){
    var padding = (str.length >= len) ? '' : Array(1 + len - str.length >>> 0).join(chr);
    return leftJustify ? str + padding : padding  + str;
  }
  var prePad = function(src, len, ch){
    var ch = ch || ' ', r = '', space = pad('', len, ch, true);
    src.split('\n').forEach(function(line){
       r += space + line + '\n';
    });
    return r;
  }
  var startsWith = function(s, needle){
    return s.indexOf(needle) === 0;
  }
  var ltrim = function(str){
    return str.replace(/^\s\s*/, '')
  }
  var rtrim = function(str){
    return str.replace(/\s\s*$/, '');
  }
  var trim = function(str) {
    return ltrim(rtrim(str));
  }
  var strlen = function(str){
    return str.length;
  }
  var fixPosition = function(src){
    var maxLen = [];
    src.split('\n').forEach(function(line){
      var fields = line.split('^');
      for(var i=0; i < fields.length; i++){
        if(!maxLen[i]){
          maxLen[i] = Math.max(-1, strlen(trim(fields[i])));
        } else {
          maxLen[i] = Math.max(maxLen[i], strlen(trim(fields[i])));
        }
      }
    });
    var r = '';
    src.split('\n').forEach(function(line){
      var fields = line.split('^');
      for(var i=0; i < fields.length; i++){
        r += pad(trim(fields[i]), maxLen[i] + 1, ' ', true);
      }
      r += '\n';
    });
    return rtrim(r);
  }
  return {
    genProperty : function(src){
        var trimmedSrc = src.trim();
        if(hashCode(trimmedSrc) !== srcHashCode){
          setItemArray(trimmedSrc);
        }
        var r = '';
        itemArray.forEach(function(fields){
          r += '@FieldInfo(name="' + fields.comment + '")\n';
          r += getSize(fields.dataType);
          r += 'private String ' + toPropery(fields.columnName) + ';\n\n';
        });
        return r;
    },
    selectStatement : function(tableName, src){
      var tableName = tableName || 'xxxxx';
      var tablePrefix = getTablePrefix(tableName);
      var r = '';
      r += 'SELECT\n';
      var tmp = applyFormat(src, "," + tablePrefix + "{1} ^ AS {2} ^ /** {3} */");
          tmp = fixPosition(tmp);
          tmp = removeFirst(tmp, ',');
          tmp = prePad(tmp, 4, ' ');
      r += tmp ;
      r += 'FROM ' + tablePrefix + tableName +'\n';
      r += 'WHERE 1=1\n';
      return r;
    },
    insertStatement : function(tableName, src){
      var tableName = tableName || 'xxxxx';
      var r = '', tmp;
      r += 'INSERT INTO ' + tableName + '\n(\n';
      tmp = applyFormat(src, ',{1} ^ /** {3} */');
      r += tmp;
      r += '\n)VALUES(\n';
      tmp = applyFormat(src, ",#{2}# /** {3}  */");
      r += tmp;
      r += '\n)';
      return r;
    },
    updateStatement : function(tableName, src){
    },
    deleteStatement : function(tableName, src){
    },
    mergeStatement  : function(tableName, src){
    }
  }
})();
