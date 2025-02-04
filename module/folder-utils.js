import * as Logger from './logger.js';

// This needs to be added here to make sure that when creating folder name we are not adding characters allowed by foundry naming but not allowed by file system like :  this is probably a little extra overboard
export function makeStringSafe(dirtyThing){
    //var safeString = String(dirtyThing).replace(/[:".!*+?&^$<>{}()@/|[\]\\]/g,"");
    //this uses unicode matching in regex to remove the following:
    // \p{P} -any kind of punctuation character. 
    // \p{S} - math symbols, currency signs, dingbats, box-drawing characters, etc.
    // \p{C} - invisible control characters and unused code points.
    var safeString = String(dirtyThing).replace(/[\p{P}\p{S}\p{C}]/gu,"");
    //console.log(safeString);
    return safeString;
}

export const getCleanAncestors = (target, children, ancestors = []) => {
    for (let node of children) {
      let id = '';
      let name = '';
      if(node._id == undefined){
        id = node.folder._id;
        name = node.folder.name;
      } else{
        id = node.id;
        name = node.name;
      }
      if (id === target) {
        return ancestors.concat(String(makeStringSafe(name).replace(/\s+/g, '-')));
      }

      const found = getCleanAncestors(target, node.children, ancestors.concat(String(makeStringSafe(name).replace(/\s+/g, '-'))));
      if (found) {
        return found;
      }
    }
    return undefined;
};

export async function generateFolderStringsMap (tree){
    let folderMap = new Map();
    game.folders.forEach(folder => {
        //set it to a new key-value in case we want to write it back to the DB later?
        let filefolder = folder.type+'/'+getCleanAncestors(folder._id, tree).join('/');
        Logger.log(`Full Path This File: ${filefolder}`);
        //put it into a map because thats just easier to use
        folderMap.set(String(folder._id),String(filefolder));
    });
    return folderMap;
}

//This function will take a folder object and join it with the file map that was created that contains keys
//and the full file path, we then split that and send it in a loop down to the actual folder creation function.
export async function exportFolderPath(folder, parentPath, filemap, markdownPathOptions) {
    let fullpath  = filemap.get(folder._id);
    Logger.log(`Export Folder: ${fullpath}`);
    let arrayOfFolders = fullpath.split('/');
    Logger.log(`Export Array: ${arrayOfFolders}`);
    let i = 0;
    while(i<arrayOfFolders.length){
        Logger.log(arrayOfFolders[i]);
        await folderCreate(parentPath, arrayOfFolders[i],markdownPathOptions);
        parentPath = parentPath.concat('/',arrayOfFolders[i]).replace("//", "/").trim();
        i++;
    }
}

async function folderCreate(parentPath, folderToCreate, markdownPathOptions){
    // Create folder directory on server. 
    // Try and create parent path before child, have to catch error 
    // as no way to check for folder existance that I saw
    if(folderToCreate!='undefined'){
        FilePicker.createDirectory(markdownPathOptions.activeSource,parentPath+'/'+folderToCreate)
        .then((result) => {
            Logger.log(`Creating Parent: ${folderToCreate}`);
        })
        .catch((error) => {
            if (!error.includes("EEXIST")) {
                Logger.log(error);
            } else {
                Logger.log(`${folderToCreate} exists`);
            }
        });
    }
}

//This takes in an array of compendium UUID objects and will then transfer those to a map with key
export async function generateCompendiumFoldersMap(compArray){
    let compendiumMap = new Map();
    for(let i=0;i<compArray.length;i++){
        let stringArray = compArray[i].UUID.split('.');
        compendiumMap.set(stringArray[1]+'.'+stringArray[2],stringArray[0]+'/'+stringArray[1]+'/'+stringArray[2]);
    }
    Logger.log(compendiumMap);
    return compendiumMap;
}

//This function will take a folder path string, we then split that and send it in a loop down to the actual folder creation function.
export async function exportFolderPathString(folderPath, parentPath, markdownPathOptions){
    Logger.log(`Export Folder: ${folderPath}`);
    let arrayOfFolders = folderPath.split('/');
    Logger.log(`Export Array: ${arrayOfFolders}`);
    let i = 0;
    while(i<arrayOfFolders.length){
        Logger.log(arrayOfFolders[i]);
        await folderCreate(parentPath, arrayOfFolders[i],markdownPathOptions);
        parentPath = parentPath.concat('/',arrayOfFolders[i]).replace("//", "/").trim();
        i++;
    }
}