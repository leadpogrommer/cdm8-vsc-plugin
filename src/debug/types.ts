
// emulator state
type CdmRegisterName = 'r0' | 'r1' | 'r2' | 'r3' | 'ps' | 'sp' | 'pc';
interface ICdm8State {
    registers: Record<CdmRegisterName, number>;
    memory: number[];
}



// requests to emulator
type CdmRequest = CdmStepRequest | CdmSetBreakpointsRequest | CdmPauseRequest | CdmContinueRequest | CdmSetLineLocationsRequest;
interface CdmStepRequest {
    action: 'step';
}

interface CdmSetBreakpointsRequest{
    action: 'breakpoints'
    data: number[];
}

interface CdmSetLineLocationsRequest{
    action: 'line_locations'
    data: number[];
}

interface CdmPauseRequest{
    action: 'pause',
}

interface CdmContinueRequest{
    action: 'continue',
}

// events from emulator
type CdmEvent = CdmStateEvent | CdmStopEvent | CdmErrorEvent;
interface CdmStopEvent {
    action: 'stop'
    reason: string
}

interface CdmStateEvent {
    action: 'state';
    data: ICdm8State;
}

interface CdmErrorEvent {
    action: 'error'
    data: string
}