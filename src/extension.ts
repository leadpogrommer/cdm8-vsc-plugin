// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CancellationToken, DebugConfiguration, ProviderResult, WorkspaceFolder } from 'vscode';
import { CdmDebugSession } from './cdmDebug';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // activate debug
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.cdm8.debugEditorContents', (resource: vscode.Uri) => {
            let targetResource = resource;
            if (!targetResource && vscode.window.activeTextEditor) {
                targetResource = vscode.window.activeTextEditor.document.uri;
            }
            if (targetResource) {
                vscode.debug.startDebugging(undefined, {
                    type: 'cdm8',
                    name: 'Run File',
                    request: 'launch',
                    program: targetResource.fsPath,
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.cdm8.getProgramName', (config) => {
            return vscode.window.showInputBox({
                placeHolder: 'Please enter the name of a .asm file in the workspace folder',
                value: 'program.asm',
            });
        })
    );

    // register debugger itself
    const provider = new CdmConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('cdm8', provider));

    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(
            'cdm8',
            {
                provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
                    return [
                        {
                            name: 'Dynamic Launch',
                            request: 'launch',
                            type: 'cdm8',
                            program: '${file}',
                        },
                    ];
                },
            },
            vscode.DebugConfigurationProviderTriggerKind.Dynamic
        )
    );

    const factory = new InlineDebugAdapterFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('cdm8', factory));
    if ('dispose' in factory) {
        // i don't know ts
        context.subscriptions.push(factory as unknown as { dispose(): any });
    }
}

class CdmConfigurationProvider implements vscode.DebugConfigurationProvider {
    /**
     * Massage a debug configuration just before a debug session is being launched,
     * e.g. add all missing attributes to the debug configuration.
     */
    resolveDebugConfiguration(
        folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        token?: CancellationToken
    ): ProviderResult<DebugConfiguration> {
        // if launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'cdm8asm') {
                config.type = 'cdm8';
                config.name = 'Launch';
                config.request = 'launch';
                config.program = '${file}';
            }
        }

        if (!config.program) {
            return vscode.window.showInformationMessage('Cannot find a program to debug').then((_) => {
                return undefined; // abort launch
            });
        }

        return config;
    }
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterInlineImplementation(new CdmDebugSession());
    }
}

// this method is called when your extension is deactivated
export function deactivate() {}
