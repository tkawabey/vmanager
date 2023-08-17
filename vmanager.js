/* 連想配列のキーをソートするライブラリー
　インストールしていない場合は、以下のコマンドでインストールしておくこと。
　npm install lodash
*/
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
/*
    ショートカットのリンク先を取得するライブラリー
　インストールしていない場合は、以下のコマンドでインストールしておくこと。
    npm install windows-shortcuts
*/
//const windowsShortcuts = require('windows-shortcuts');
//const iconv = require('iconv-lite');
//const { getPath } = require('windows-shortcuts-ps');
var winshortcut = require('./cpp_addon/build/Release/winshortcut');

// 設定情報
const config = require('./config.json');

/* グループ情報 */
class MyGroup{

    constructor(name, important) {
        this.name = name;   // グループ名前
        this.important = important;       //   重大度
        this.strages = [];  //　ストレージ一覧
        this.files = [];    // ファイル一覧

    }
}
/* ファイル情報 */
class FileD{
    constructor(group, name, iStrage) {
        this.group = group; // 親グループ
        this.name = name;   // ファイル名
        this.mcode = "";    // コード　ファイルの先頭から最初のスペースまでの文字で、^[A-Za-z]*-[0-9]* とします
        this.ext = "";      // ファイルの拡張子
        this.iStrage = iStrage;     // ストレージ名
        this.isLink = false;    // ショートカットかどうか
        this.strLinkTarget = "";    // ショートカットの先のファイルのパス
        this.cntLinked = [];    // このファイルに対してショートカットが作成されているショートカットファイルのフルパス

        // 指定したファイル名からコード文字を取得
        function getCodeString(strFileName)
        {  
            var mcode = "";
            if( isFirstCharAlphabet(strFileName) == true )
            { 
                // 最初のスペース
                var idxCode = strFileName.indexOf(" ");
                if( idxCode != -1 )
                {
                    var strCode =  strFileName.substring(0, idxCode);
                    idxCode = strCode.indexOf("-");
                    if( idxCode != -1 )
                    {
                        var strNumber =  strCode.substring(idxCode+1);
                        if( isFirstCharNumber(strNumber) == true )
                        {       
                            mcode = strCode;
                        }
                    }
                }  
            }
            return mcode;
        }
        // 管理コード
        this.mcode = getCodeString(name);
        // 拡張子
        var idx = name.lastIndexOf(".");
        if( idx != -1 )
        {
            this.ext = name.substring(idx+1);
        }
        // フルパス
        this.strFullPath = path.join(group.strages[iStrage], name);
        // 拡張子がlnkの場合、リンク先のパスを取得しておく
        if( this.ext == "lnk" )
        {
            this.isLink = true;
            this.strLinkTarget = winshortcut.getAbsoltePath(this.strFullPath);
        }
    }
}

// 指定した拡張子文字が、設定ファイルに記載された定義に含まれているか調べる
function isTargetExt( ext )
{
    for(const extDst of config.targetExt )
    {
        if( ext == extDst )
        {
            return true;
        }
    }
    return false;
}


function isFirstCharAlphabet(str) {
    // 正規表現を使用して最初の文字がアルファベットかどうかをチェック
    return /^[A-Za-z]/.test(str);
  }
function isFirstCharNumber(str) {
    // 正規表現を使用して最初の文字が数値かどうかをチェック
    return /^[0-9]/.test(str);
  }

// ファイル名の接頭字が、指定文字と一緒ならカットしてリネームする 
function renameIfFoundStr(currentDir, strFName, strFind)
{
    var idx = strFName.indexOf(strFind);
    if( idx == 0 )
    {
        const fullPath = path.join(currentDir, strFName);
        var rnameFname = strFName.substring( idx+ strFind.length ).trim();

        const fullPathRName = path.join(currentDir, rnameFname);

        console.log("rename " + fullPath + "  " + fullPathRName  );


        fs.rename(fullPath, fullPathRName, (err) => {
            if (err) throw err;
        
            console.log('ファイルを移動しました');
        });

        // 戻り値破、リネーム後の名前
        strFName = rnameFname;
    }

    return strFName;
}



function listFilesRecursively(strages) 
{
    const groups = {};
    function traverse(currentDir, parentName, iStrage) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                traverse(fullPath, entry.name, iStrage);
            } else {
                var idx = -1;
                var important = "";
                var key = parentName;
                idx = key.indexOf("★");
                if(idx != -1)
                {
                    important = "★";
                    var strFirsr = key.substring(0,idx ).trim();
                    var strLast = key.substring( idx+1 ).trim();
                    
                    key = strFirsr+strLast;
                }
                idx = key.indexOf("▼");
                if(idx != -1)
                {
                    important = "▼";
                    var strFirsr = key.substring(0,idx ).trim();
                    var strLast = key.substring( idx+1 ).trim();
                    
                    key = strFirsr+strLast;
                }

                
                var group = groups[key];
                if( group == null )
                {
                    group = new MyGroup(key, important);
                    groups[key] = group;
                } 
                group.strages[iStrage] = currentDir;

                var strFName = entry.name;

                // ファイル名を変更します。
                for (const cutStr of config.cutPrefixStrings) {
                    strFName = renameIfFoundStr(currentDir, strFName, cutStr);
                }

                function isTargetRegistFile(name)
                {
                    if(  name.endsWith(".lnk") ) 
                    {
                        return true;
                    }
                    for(const ext of config.targetExt )
                    {
                        var extd = "." + ext;
                        if(  name.endsWith(extd) ) 
                        {
                            return true;
                        }
                    }
                    return false;
                }
                if(  isTargetRegistFile(entry.name)  ) 
                {
                   var fileD = new FileD(group, strFName, iStrage);
                   group.files.push( fileD );
                }
            }
        }
    }

    // 接待ファイルに記載されたターゲットのディレクトリをサーチする。
    for(key in strages)
    {
        traverse(strages[key], ``, key);
    }


    // ファイルがリンクされているリスト情報を作成
    for (let key in groups) {
        var group = groups[key];
        for(var fileD of  group.files )
        {
            if( fileD.isLink == true )
            {                
                for (let key2 in groups) {
                    var group2 = groups[key2];
                    for(var fileD2 of  group2.files )
                    {
                        if( fileD != fileD2 )
                        {
                            if( fileD.strLinkTarget == fileD2.strFullPath )
                            {
                                fileD2.cntLinked.push( fileD.strFullPath );
                            }
                        }
                    }
                }
            }        
        }
    }
    return groups;
}


var command = -1; // コマンド。 0:ファイル名変更 1:ファイルの削除

// コマンドラインの解析
if( process.argv.length > 2 )
{
    if( process.argv[2] == "move" || process.argv[2] == "rename")
    {
        // ファイルの移動
        if( process.argv.length < 5 )
        {
            console.log("Invalid command line argument.");
            return ;
        }
        command = 0;
    } 
    else
    if( process.argv[2] == "remove" || process.argv[2] == "delete" )
    {
        // ファイルの削除
        if( process.argv.length < 4 )
        {
            console.log("Invalid command line argument.");
            return ;
        }
        command = 1;
    } 
    else 
    {
        console.log("unknon command.");
        return ;
    }

}



const actorList =  listFilesRecursively( config.strages );

// オブジェクトのキーをソート
const sortedKeys = _.sortBy(Object.keys(actorList));


if( command == 0 )
{
    var found = false;
    // ファイルのリネーム
    sortedKeys.forEach(key => {
        var group = actorList[key];
        for(var fileD of  group.files )
        {
            if( fileD.strFullPath == process.argv[3] )
            {
                found = true;
                fs.rename(process.argv[3], process.argv[4], (err) => {
                    if (err) throw err;                
                    console.log('ファイルを移動しました');
                });

                for(var linkdF of  fileD.cntLinked )
                {
                    // ショートカットがリンクされていた場合は、ショートカットのリンク先も変更する。
                    winshortcut.setAbsoltePath(linkdF, process.argv[4]);

                    console.log('  ショートカットのリンク先を変更しました :' + linkdF);
                }
            }
        }
    });
    if( found == false )
    {
        console.log("ファイルが見つかりません :" + process.argv[3] );
    }
    return ;
}
else
if( command == 1 )
{
    var found = false;
    // ファイルのリネーム
    sortedKeys.forEach(key => {
        var group = actorList[key];
        for(var fileD of  group.files )
        {
            if( fileD.strFullPath == process.argv[3] )
            {
                found = true;
                if( fileD.cntLinked.length != 0 )
                {
                    console.log('削除しようとしているファイルにショットカットのリンク先が存在するので、削除できません');
                    return ;
                }


                found = true;
                fs.unlink(process.argv[3],  (err) => {
                    if (err) throw err;                
                    console.log('ファイルを削除しました');
                });
            }
        }
    });
    if( found == false )
    {
        console.log("ファイルが見つかりません :" + process.argv[3] );
    }
    return ;
}



//
const stream = fs.createWriteStream(config.output);

// ソートされたキーごとに値を取得
sortedKeys.forEach(key => {
    //console.log(`${key}: ${myObject[key]}`);

    var group = actorList[key];
    var findPos = group.name.indexOf(`_`, 0);
    if( findPos != -1 )
    {
        var alphabet = group.name.substring(0,findPos ).trim();
        var strLocal = group.name.substring( findPos+1 ).trim();
        stream.write(alphabet);
        stream.write("\t");
        stream.write(strLocal); 
        stream.write("\t");  
    }
    else
    {
        stream.write(group.name);
        stream.write("\t");
        stream.write("\t");  
    }
    stream.write(group.important);
    stream.write("\t");  

    var tab = "";
    for(var fileD of  group.files )
    {
        var file = fileD.name;
        stream.write(tab);

        stream.write(fileD.mcode);
        stream.write("\t"); 

        stream.write("" + fileD.iStrage);
        stream.write("\t");


        if( fileD.isLink == true )
        {
            stream.write("L");
            if (fs.existsSync(fileD.strLinkTarget) == false ) {
                stream.write("リンク先のターゲットがみつかりません");
            }
        }
        stream.write("\t");

        stream.write(file);
        stream.write("\t");

        if( fileD.isLink == true )
        {
            stream.write(fileD.strLinkTarget);
        }
        stream.write("\n");
        tab = "\t\t\t"; 

        for(var linkdF of  fileD.cntLinked )
        {

            stream.write("\t\t\t\t\t\t");
            stream.write("  --> ");
            stream.write(linkdF);
            stream.write("\n");

        }


    }
    if( tab == "" )
    {
        stream.write("\n");
    }
});


// ファイル名の重複をチェックします
sortedKeys.forEach(key => {
    var group = actorList[key];
    for(var fileD of  group.files )
    {
        if( fileD.isLink == false ) 
        {
            for (let key2 in actorList) {
                var group2 = actorList[key2];
                for(var fileD2 of  group2.files )
                {
                    if( fileD != fileD2 )
                    {
                        if( fileD.name == fileD2.name )
                        {
                            console.log(`same file found: ` + fileD.name);
                            console.log(`\t` + group.strages[fileD.iStrage]);
                            console.log(`\t` + group2.strages[fileD2.iStrage]);
                        }
                    }
                }
            }
        }
    }
});
// コードの重複をチェックします
sortedKeys.forEach(key => {
    var group = actorList[key];
    for(var fileD of  group.files )
    {
        if( fileD.mcode.length != 0 && fileD.isLink == false )
        {
            for (let key2 in actorList) {
                var group2 = actorList[key2];
                for(var fileD2 of  group2.files )
                {
                    if( fileD != fileD2 )
                    {
                        if( fileD2.isLink == false && fileD.mcode == fileD2.mcode )
                        {
                            console.log(`same CODE found : ` + fileD.mcode);
                            console.log(`\t` + path.join(group.strages[fileD.iStrage], fileD.name));
                            console.log(`\t` + path.join(group2.strages[fileD2.iStrage], fileD2.name));
                        }
                    }
                }
            }
        }        
    }
});



console.log("exit");