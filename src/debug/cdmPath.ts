import * as vscode from 'vscode';
import * as fs from 'fs';
import { join} from 'path';

export async function verifyCdmPath(path: string): Promise<boolean> {
    if(typeof(path) !== 'string') {
        return false;
    }
    const checkFiles = ['assembler/main.py', 'emulator/emulator.py'];

    for(const file of checkFiles){
        try{
            let stat = await fs.promises.stat(join(path, file));
            if(!stat.isFile){
                return false;   
            }
        }catch (e){
            return false;
        }
    }
    return true;
}