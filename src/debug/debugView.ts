import * as vscode from 'vscode';
import { cdmDebugSessionType } from './activateDebug';
import * as path from 'path';
import * as fs from 'fs';

export function activateDebugView(context: vscode.ExtensionContext){
    let currentPanel: vscode.WebviewPanel | undefined;

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
                enableScripts: true
            });
            // currentPanel.webview.html = '<html><body>hello?</body></html>';
            const onDiskPath = path.join(context.extensionPath, 'dist', 'webviews', 'debugView', 'index.html');



            currentPanel.webview.html = (await fs.promises.readFile(onDiskPath)).toString();

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