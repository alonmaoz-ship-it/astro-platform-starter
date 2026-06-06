// Tesla Charger Types
export type ChargerStatus = 'available' | 'connected' | 'charging' | 'error';

export type ChargingSession = {
    id: string;
    startTime: string;
    endTime?: string;
    energyDelivered: number; // kWh
    maxPower: number; // kW
    vehicleId?: string;
};

export type ChargerConfig = {
    id: string;
    name: string;
    location: string;
    maxPower: number; // kW
    status: ChargerStatus;
    currentSession?: ChargingSession;
    lastUpdated: string;
};

export type ChargerAction = 'register' | 'start' | 'stop' | 'connect' | 'disconnect' | 'energyUpdate' | 'update';

export type ChargerActionRequest = {
    action: ChargerAction;
    chargerId?: string;
    vehicleId?: string;
    energyDelivered?: number;
    config?: Partial<ChargerConfig>;
};

export type BlobParameterProps = {
    seed: number;
    size: number;
    edges: number;
    growth: number;
    name: string;
    colors: string[];
};

export type BlobProps = {
    svgPath: string;
    parameters: BlobParameterProps;
};
