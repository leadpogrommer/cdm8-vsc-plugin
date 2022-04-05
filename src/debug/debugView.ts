import * as vscode from 'vscode';
import { cdmDebugSessionType } from './activateDebug';
import * as path from 'path';
import * as fs from 'fs';

export function activateDebugView(context: vscode.ExtensionContext){
    let currentPanel: vscode.WebviewPanel | undefined;


    // react to events from debugger
    context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent((e) => {
        console.log(`Got custom event: ${JSON.stringify(e)}`);
        currentPanel?.webview.postMessage(e);
    }));


    context.subscriptions.push(vscode.debug.onDidStartDebugSession(async (session) => {
        if(session.type !== cdmDebugSessionType){
            return;
        }

        if(currentPanel){
            currentPanel.reveal(vscode.ViewColumn.Beside);
        }else{
            currentPanel = vscode.window.createWebviewPanel('cdmDebugPanel', 'Cdm8e debug', vscode.ViewColumn.Beside, {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(context.extensionPath)]
            });

            const basePath = path.join(context.extensionPath, 'dist', 'webviews', 'debugView');
            const htmlPath = path.join(basePath.toString(), 'index.html');


            let htmlContent = (await fs.promises.readFile(htmlPath)).toString();

            let scriptJsPath = vscode.Uri.file(path.join(basePath.toString(), 'index.js'));
            let scriptJsUri = scriptJsPath.with({ scheme: 'vscode-resource' });

            htmlContent = htmlContent.replace('%SCRIPT_PATH%', scriptJsUri.toString());

            currentPanel.webview.html = htmlContent;

            currentPanel.onDidDispose(()=>{
                currentPanel = undefined;
                if(vscode.debug.activeDebugSession?.type === cdmDebugSessionType){
                    vscode.debug.stopDebugging();
                }
            },
            undefined,
            context.subscriptions);
        }

    }));

    context.subscriptions.push(vscode.debug.onDidTerminateDebugSession((session) => {
        if(session.type !== cdmDebugSessionType){
            return;
        }
    }));
}