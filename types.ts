export enum FileType {
  IMAGE = 'IMAGE',
  TEXT = 'TEXT',
  PDF = 'PDF', // Treated as text for simplicity in this demo if text extraction were added
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
  id: string;
  name: string;
  type: DeviceType;
  status: 'online' | 'transferring' | 'offline';
  ip: string;
}

export interface SmartMetaData {
  summary?: string;
  tags?: string[];
  suggestedAction?: string;
  language?: string;
}

export interface TransferFile {
  id: string;
  fileObject: File;
  name: string;
  size: number;
  type: FileType;
  url: string;
  timestamp: number;
  fromDevice: string;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'failed' | 'skipped';
  metaData?: SmartMetaData;
}
