import * as vscode from 'vscode';
import { cdmDebugSessionType } from './activateDebug';

export function activateDebugView(context: vscode.ExtensionContext){
    let currentPanel: vscode.WebviewPanel | undefined;

    context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent((e) => {
        console.log(`Got custom event: ${JSON.stringify(e)}`);
    }));


    context.subscriptions.push(vscode.debug.onDidStartDebugSession((session) => {
        if(session.type !== cdmDebugSessionType){
            return;
        }

        if(currentPanel){
            currentPanel.reveal(vscode.ViewColumn.Beside);
        }else{
            currentPanel = vscode.window.createWebviewPanel('cdmDebugPanel', 'Cdm8e debug', vscode.ViewColumn.Beside, {
                enableScripts: true
            });
            currentPanel.webview.html = '<html><body>hello?</body></html>';
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