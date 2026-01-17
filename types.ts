export enum FileType {
  IMAGE = 'IMAGE',
  TEXT = 'TEXT',
  PDF = 'PDF',
  VIDEO = 'VIDEO',
  UNKNOWN = 'UNKNOWN'
}

export enum DeviceType {
  ANDROID = 'Android',
  IOS = 'iOS',
  WINDOWS = 'Windows',
  MAC = 'Mac'
}

export interface ConnectedDevice {
  id: string; // Peer ID
  name: string;
  type: DeviceType;
  status: 'online' | 'transferring' | 'offline';
  ip?: string;
  connection?: any; // PeerJS DataConnection
}

export interface SmartMetaData {
  summary?: string;
  tags?: string[];
  suggestedAction?: string;
  language?: string;
}

export type TransferStatus = 'queued' | 'sending' | 'completed' | 'failed' | 'received';

export interface TransferFile {
  id: string;
  fileObject: File | Blob; // Can be a received Blob
  name: string;
  size: number;
  type: FileType;
  url: string;
  timestamp: number;
  fromDevice: string;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'failed' | 'skipped';
  transferStatus: TransferStatus;
  progress?: number; // 0-100
  metaData?: SmartMetaData;
}

// P2P Message Protocol
export interface P2PMessage {
    type: 'HANDSHAKE' | 'FILE_META' | 'FILE_CHUNK' | 'FILE_END';
    payload: any;
}