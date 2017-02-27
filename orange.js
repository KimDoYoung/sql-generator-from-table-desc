"use strict";
var orange = (function(){
  var srcHashCode; //
  var itemArray = [];
  var hashCode = function(s){
    return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
  }
  function setItemArray(src){
    var trimmedSrc = trim(src), code = hashCode(trimmedSrc);
    if( code === srcHashCode){
      return;
    }
    srcHashCode = code;
    var includeHead = false, no = 0;
    trimmedSrc.split('\n').forEach(function(line){
        var fields = line.split('\t');
        if(fields[0].toUpperCase() === 'NAME' && fields[1].toUpperCase() === 'TYPE') {
          includeHead = true; return true;
        }
        var columnName, dataType, isPK, comment, property;
        if(fields.length === 4 ){
          columnName = trim(fields[0]).toUpperCase();
          dataType = trim(fields[1]).toUpperCase();
          isPK = true;
          comment = trim(fields[3]);
        }else if( fields.length === 3 ){
          columnName = trim(fields[0]).toUpperCase();
          dataType = trim(fields[1]).toUpperCase();
          isPK = false;
          comment = trim(fields[2]);
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
  var applyFormat=function(src, formatString, option ){
      var option = option || 'all';
      setItemArray(src);
      var r = '';
      itemArray.forEach(function(fields){
        if(option == 'pkonly' && !fields.isPK  ) {
           return true;
        }else if(option == 'notpkonly' && fields.isPK) {
          return true;
        }

        var property = toPropery(fields.columnName);
        r += format(formatString, fields.no, fields.columnName, fields.property, fields.comment)+'\n';
      });
      return r.trim();
  }
  var getTablePrefix = function(tableName){
    if(tableName === '' || startsWith(tableName, 'xxx') ){
       return '';
     }else {
       return tableName.substring(0, 6).toUpperCase() ;
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
    return rtrim(r);
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
  var whereCondition = function(src){
    setItemArray(src);
    var r = '';
    itemArray.forEach(function(item){
      if(item.isPK){
         r = 'AND ' + item.columnName + ' = #' + item.property + '#\n';
      }
    });
    return r;
  }
  var maxLength= function(name){
    var maxLen = -1;
    itemArray.forEach(function(item){
       var len = strlen(item.name+'');
       maxLen = len > maxLen ? len : maxLen;
    });
    return maxLen;
  }
  return {
    genProperty : function(src){
        setItemArray(src);
        var r = '';
        itemArray.forEach(function(fields){
          r += '@FieldInfo(name="' + fields.comment + '")\n';
          r += getSize(fields.dataType);
          r += 'private String ' + toPropery(fields.columnName) + ';\n\n';
        });
        return r;
    },
    genTable : function(src){
        setItemArray(src);
        var r = '<table border="1">\n';
        r += '<tr><td>No</td><td>Column name</td><td>Type</td><td>nullable</td><td>comment</td><tr>';
        itemArray.forEach(function(fields){
          r += '<tr>';
          var pk = fields.isPK ? 'PK' : '';
          r += format('<td>{0}</td><td>{1}</td><td>{2}</td><td>{3}</td><td>{4}</td>',
            fields.no, fields.columnName, fields.dataType, pk, fields.comment
          )
          r += '</tr>';
        });
        r += '</table>'
        return r;

    },
    selectStatement : function(tableName, src){
      setItemArray(src);
      var tableName = tableName || 'xxxxx';
      var tablePrefix = getTablePrefix(tableName), tablePrefix2;
      var r = '';
      r += 'SELECT\n';
      if(tablePrefix != '') tablePrefix2 = tablePrefix + '.';
      var tmp = applyFormat(src, "," + tablePrefix2 + "{1} ^ AS {2} ^ /** {3} */");
          tmp = fixPosition(tmp);
          tmp = removeFirst(tmp, ',');
          tmp = prePad(tmp, 4, ' ');
      r += tmp ;
      r += '\nFROM ' +  tableName + ' ' + tablePrefix + '\n';
      r += 'WHERE 1=1\n';
      return r;
    },
    insertStatement : function(tableName, src){
      setItemArray(src);
      var tableName = tableName || 'xxxxx';
      var r = '', tmp;
      r += 'INSERT INTO ' + tableName + '\n(\n';
      tmp = applyFormat(src, ',{1} ^ /** {3} */');
      tmp = fixPosition(tmp);
      tmp = removeFirst(tmp, ',');
      tmp = prePad(tmp, 4, ' ');
      r += tmp;
      r += '\n)VALUES(\n';
      tmp = applyFormat(src, ",#{2}# /** {3}  */");
      tmp = fixPosition(tmp);
      tmp = removeFirst(tmp, ',');
      tmp = prePad(tmp, 4, ' ');
      r += tmp;
      r += '\n)';
      return r;
    },
    updateStatement : function(tableName, src){
      setItemArray(src);
      var tableName = tableName || 'xxxxx', r = '', tmp ;
      r += 'UPDATE ' + tableName + '\n';
      r += 'SET\n';
      tmp = applyFormat(src, ",{1} ^ = ^ #{2} ^ /** {3} */");
      tmp = fixPosition(tmp);
      tmp = removeFirst(tmp, ',');
      tmp = prePad(tmp, 4, ' ');
      r += tmp;
      r += '\nWHERE 1=1\n';
      tmp = whereCondition(src);
      tmp = prePad(tmp, 4, ' ');
      r += tmp;
      return r;
    },
    deleteStatement : function(tableName, src){
      setItemArray(src);
      var r = '';
      var tableName = tableName || 'xxxxx', r = '', tmp ;
      r += 'DELETE FROM ' + tableName + '\n';
      r += 'WHERE 1=1\n';
      r += prePad(whereCondition(src), 4);
      return r;
    },
    mergeStatement  : function(tableName, src){
      setItemArray(src);
      var tableName = tableName || 'xxxxx', r = '', tmp ;
      var r = '',tmp;
      r += 'MERGE INTO ' + tableName + '\n';
      r += 'USING DUAL\n';
      r += '    ON ( ';
      var tmpArray = [], maxColumnNameLength = 0, maxPropertyLength = 0;
      itemArray.forEach(function(item){
        if(item.isPK) {
          tmpArray.push(item.columnName + ' = #' + item.property + '#');
        }
      });
      r += tmpArray.join(' AND ');
      r += ' )\n';
      r += 'WHEN MATCHED THEN\n';
      r += 'UPDATE SET\n';
      tmp = applyFormat(src, ",{1} ^ = ^ #{2} ^ /** {3} */",'notpkonly');
      tmp = fixPosition(tmp);
      tmp = removeFirst(tmp, ',');
      tmp = prePad(tmp, 4, ' ');
      r += tmp;
      r += '\nWHEN NOT MATCHED THEN\n';
      r += 'INSERT\n(\n';
      tmp = applyFormat(src, ',{1} ^ /** {3} */');
      tmp = fixPosition(tmp);
      tmp = removeFirst(tmp, ',');
      tmp = prePad(tmp, 4, ' ');
      r += tmp;
      r += '\n)VALUES(\n';
      tmp = applyFormat(src, ",#{2}# /** {3}  */");
      tmp = fixPosition(tmp);
      tmp = removeFirst(tmp, ',');
      tmp = prePad(tmp, 4, ' ');
      r += tmp;
      r += '\n)';
      return r;
    },//end mergeStatement
    applyFormat : function(src,formatString){
      setItemArray(src);
      var r =  applyFormat(src, formatString);
      r = fixPosition(r);
      return r;
    }
  }
})();
