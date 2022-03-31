import {
    Logger,
    logger,
    LoggingDebugSession,
    DebugSession,
    InitializedEvent,
    TerminatedEvent,
    StoppedEvent,
    BreakpointEvent,
    OutputEvent,
    ProgressStartEvent,
    ProgressUpdateEvent,
    ProgressEndEvent,
    InvalidatedEvent,
    Thread,
    StackFrame,
    Scope,
    Source,
    Handles,
    Breakpoint,
    MemoryEvent,
    Variable,
    Response,
    Event,
    
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { ChildProcess, exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createInterface } from 'readline';
import internal = require('stream');
import WebSocket = require('ws');
import { createResolvable } from '../util';

const assemblerPath = '/home/ilya/work/cdm8e/ORiGinalASM/assembler/main.py';
const emulatorPath = '/home/ilya/work/cdm8e/ORiGinalASM/emulator/emulator.py';

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    program: string;
}


interface CodeLocation {
    file: string;
    line: number;
    column: number;
}

const registersVariableReference = 1;
const memoryVariableReference = 2;
const dataMemVariableReference = 3;

export class CdmDebugSession extends DebugSession {
    emulatorProcess!: ChildProcess;
    socket: WebSocket | null = null;
    codeMap: Map<number, CodeLocation> = new Map();
    latestState: ICdm8State | null = null;
    launched = createResolvable<void>();
    breakpointsPerFile = new Map<string, number[]>();
    static threadID = 1;

    public constructor() {
        super();

        this.setDebuggerColumnsStartAt1(true);
        this.setDebuggerLinesStartAt1(true);
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        response.body = response.body || {};

        // response.body.supVa
        // response.body.supportsConfigurationDoneRequest = true;


        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {
        console.log(`launched, program = ${args.program}`);

        const assemblerProcess = spawn('python', [assemblerPath, args.program]);
        for await (const data of assemblerProcess.stdout) {
            // console.log(data.toString());
            this.sendEvent(new OutputEvent(data.toString(), 'debug console'));
        }

        const noExtensionPath = args.program.replace(new RegExp(`${path.extname(args.program)}$`), '');
        const imgPath = noExtensionPath + '.img';
        this.emulatorProcess = spawn('python', [emulatorPath, '--serve', imgPath]);

        if (this.emulatorProcess.stdout === null || this.emulatorProcess.stderr === null) {
            this.sendEvent(new TerminatedEvent());
            return;
        }

        const emuInterface = createInterface(this.emulatorProcess.stdout);
        let emuPort!: Number;

        for await (const line of emuInterface) {
            emuPort = parseInt(line);
            break;
        }
        console.log(emuPort);

        // load debug info
        // TODO: check if we successfully loaded file
        const codeMapFile = await fs.promises.open(noExtensionPath + '.dbg.json', 'r');
        const codeMapJson = JSON.parse((await codeMapFile.readFile()).toString());
        codeMapFile.close();

        for (const [key, value] of Object.entries(codeMapJson)) {
            this.codeMap.set(parseInt(key), value as CodeLocation);
        }


        //connect to emulator
        this.socket = new WebSocket(`ws://127.0.0.1:${emuPort}`);
        this.socket.onmessage = (event) => {
            this.onEmulatorMessage(JSON.parse(event.data.toString()));
        };
        this.socket.onopen = ()=>{this.launched.resolve();};

        this.sendResponse(response);
        this.sendEvent(new StoppedEvent('entry', 1));


        console.log('done initialization');
        


    }

    private onEmulatorMessage(message: CdmEvent) {
        if (message.action === 'state') {
            // TODO: race condition: we need to wait for first state before finishing initialization
            this.latestState = message.data;
            if (this.codeMap.has(this.latestState.registers.pc)) {
                console.log(this.codeMap.get(this.latestState.registers.pc));
            }
            console.log('got state');
            this.sendEvent(new Event('cdmState', this.latestState));
        }else if(message.action === 'stop'){
            this.sendEvent(new StoppedEvent(message.reason, CdmDebugSession.threadID));
        }else if(message.action === 'error'){
            console.log('emu error');
            this.sendEvent(new OutputEvent(`Emulation error: ${message.data}`, 'important'));
            this.sendEvent(new TerminatedEvent());
        }
    }

    private async  sendEmulatorMessage(msg: CdmRequest) {
        await this.launched;
        console.log(`sending: ${JSON.stringify(msg)}`);
        this.socket?.send(JSON.stringify(msg));
    }

    protected async stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments, request?: DebugProtocol.Request) {
        this.sendEmulatorMessage({ action: 'step' });
        this.sendResponse(response);
    }

    protected async stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments, request?: DebugProtocol.Request){
        this.sendEmulatorMessage({ action: 'step' });
        this.sendResponse(response);
    }

    protected async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.Request){
        this.sendEmulatorMessage({ action: 'step' });
        this.sendResponse(response);
    }




    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        console.log('thread request');
        // runtime supports no threads so just return a default thread.
        response.body = {
            threads: [new Thread(CdmDebugSession.threadID, 'thread 1')],
        };
        this.sendResponse(response);
    }

    protected disconnectRequest(
        response: DebugProtocol.DisconnectResponse,
        args: DebugProtocol.DisconnectArguments,
        request?: DebugProtocol.Request
    ): void {
        console.log('disconnect');
        this.socket?.close();
        this.sendResponse(response);
    }

    // Requests go like this:
    // stackTrace -> scopes -> variables
    protected variablesRequest(
        response: DebugProtocol.VariablesResponse,
        args: DebugProtocol.VariablesArguments,
        request?: DebugProtocol.Request
    ): void {
        if (this.latestState === null) {
            this.sendResponse(response);
            return;
        }
        console.log('variable request');
        if (args.count === undefined || args.count === 0) {
            args.count = Infinity;
        }
        if (args.start === undefined) {
            args.start = 0;
        }
        response.body = { variables: [] };
        if (args.variablesReference === registersVariableReference) {
            for (const [name, value] of Object.entries(this.latestState.registers)) {
                response.body.variables.push(new Variable(name, value.toString()));
            }
        } else if (args.variablesReference === memoryVariableReference) {
            response.body.variables.push(new Variable('Data memory', '...', dataMemVariableReference));
        } else if (args.variablesReference === dataMemVariableReference) {
            for (let i = args.start; i < Math.min(this.latestState.memory.length, args.start + args.count); i++) {
                response.body.variables.push(new Variable(`[${i.toString(16)}]`, this.latestState.memory[i].toString()));
            }
        }

        this.sendResponse(response);
    }

    protected stackTraceRequest(
        response: DebugProtocol.StackTraceResponse,
        args: DebugProtocol.StackTraceArguments,
        request?: DebugProtocol.Request
    ): void {
        // TODO: source reference
        console.log('stack request');
        response.body = { stackFrames: [] };
        if (this.latestState !== null && this.codeMap.has(this.latestState.registers.pc)) {
            const location = this.codeMap.get(this.latestState.registers.pc)!;

            const frame = new StackFrame(0, 'frame', new Source(path.parse(location.file).base, location.file), location.line);
            response.body.totalFrames = 1;
            response.body.stackFrames.push(frame);
        } else {
            response.body.totalFrames = 0;
            response.body.stackFrames = [];
        }
        this.sendResponse(response);
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments, request?: DebugProtocol.Request): void {
        // TODO: do no hardcode frameID
        if (args.frameId === 0) {
            const registersScope = new Scope('Registers', registersVariableReference);
            const memoryScope = new Scope('Memory', memoryVariableReference);
            response.body = { scopes: [registersScope, memoryScope] };
        }

        this.sendResponse(response);
    }


    protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, request?: DebugProtocol.Request) {
        await this.launched;
        console.log(args);
        let pcBreakpoints: number[] = [];
        response.body = {breakpoints: []};
        // TODO: ineficient breakpoint set: O(n*m), n = program_length, m = breakpoints amount
        for(const breakpoint of args.breakpoints || []){
            for(const [pc, location] of this.codeMap.entries()){
                // TODO: relative pathes
                if(location.file === args.source.path && location.line === breakpoint.line){
                    pcBreakpoints.push(pc);
                response.body.breakpoints.push(new Breakpoint(true));
                }
            }
        }
        // if()
        this.breakpointsPerFile.set(args.source.path!, pcBreakpoints);


        this.sendEmulatorMessage({action: 'breakpoints', data: Array.from(this.breakpointsPerFile.values()).flat()});

        this.sendResponse(response);
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments, request?: DebugProtocol.Request): void {
        response.body = {allThreadsContinued: true};
        this.sendEmulatorMessage({action:'continue'});
        this.sendResponse(response);
    }

    protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request): void {
        this.sendEmulatorMessage({action:'pause'});
        this.sendResponse(response);
    }

    /**
     * Called at the end of the configuration sequence.
     * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
     */
    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args);

        // notify the launchRequest that configuration has finished
        // this._configurationDone.notify();
        console.log('config done');
    }
}
