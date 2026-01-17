import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TransferArea } from './components/TransferArea';
import { ConnectedDevice, DeviceType, FileType, TransferFile, P2PMessage } from './types';
import { processFileWithGemini } from './services/geminiService';
import { Peer } from 'peerjs';

const App: React.FC = () => {
  // Session State
  const [hostId, setHostId] = useState<string>('');
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  
  // Device State
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [files, setFiles] = useState<TransferFile[]>([]);
  
  // Refs for accessing state inside event listeners
  const devicesRef = useRef<ConnectedDevice[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const filesRef = useRef<TransferFile[]>([]);

  // Keep refs synced with state
  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { filesRef.current = files; }, [files]);

  // Helper: Detect my device type
  const getMyDeviceType = (): DeviceType => {
      const ua = navigator.userAgent;
      if (/android/i.test(ua)) return DeviceType.ANDROID;
      if (/iPad|iPhone|iPod/.test(ua)) return DeviceType.IOS;
      if (/Win/.test(ua)) return DeviceType.WINDOWS;
      if (/Mac/.test(ua)) return DeviceType.MAC;
      return DeviceType.WINDOWS;
  };

  // Helper: Detect my device name
  const getMyDeviceName = (): string => {
      const type = getMyDeviceType();
      // Add a random suffix to make names unique-ish for testing
      const suffix = Math.floor(Math.random() * 1000);
      return `${type} #${suffix}`; 
  };

  const handleIncomingData = useCallback((data: P2PMessage, conn: any) => {
      console.log('Handling Data:', data.type);
      
      switch (data.type) {
          case 'HANDSHAKE':
              setDevices(prev => {
                  if (prev.find(d => d.id === conn.peer)) return prev;
                  console.log('Adding new device:', data.payload.name);
                  const newDevice: ConnectedDevice = {
                      id: conn.peer,
                      name: data.payload.name,
                      type: data.payload.type,
                      status: 'online',
                      connection: conn
                  };
                  return [...prev, newDevice];
              });
              // Auto-select if no device selected
              setActiveDeviceId(prev => prev || conn.peer);
              break;

          case 'FILE_CHUNK':
              // data.payload contains { fileMeta, blob }
              const { meta, blob } = data.payload;
              // Find sender name from ref to avoid closure staleness
              const sender = devicesRef.current.find(d => d.id === conn.peer)?.name || 'Unknown Device';
              
              const receivedFile: TransferFile = {
                  id: meta.id,
                  fileObject: new File([blob], meta.name, { type: meta.type }),
                  name: meta.name,
                  size: meta.size,
                  type: determineFileType(meta.type, meta.name),
                  url: URL.createObjectURL(new Blob([blob], { type: meta.type })),
                  timestamp: Date.now(),
                  fromDevice: sender,
                  analysisStatus: 'pending',
                  transferStatus: 'received'
              };
              
              setFiles(prev => [receivedFile, ...prev]);
              processReceivedFile(receivedFile);
              break;
      }
  }, []);

  const setupConnection = useCallback((conn: any) => {
      const initHandshake = () => {
          console.log('Connection Open, sending Handshake to:', conn.peer);
          conn.send({
              type: 'HANDSHAKE',
              payload: {
                  name: getMyDeviceName(),
                  type: getMyDeviceType()
              }
          });
      };

      if (conn.open) {
          initHandshake();
      } else {
          conn.on('open', initHandshake);
      }

      conn.on('data', (data: P2PMessage) => handleIncomingData(data, conn));
      
      conn.on('close', () => {
          console.log('Connection closed:', conn.peer);
          setDevices(prev => prev.map(d => d.id === conn.peer ? { ...d, status: 'offline' } : d));
      });
      
      conn.on('error', (err: any) => console.error('Connection Error:', err));
  }, [handleIncomingData]);

  // Initialize Session & PeerJS
  useEffect(() => {
    const initPeer = async () => {
      const params = new URLSearchParams(window.location.search);
      const remoteHostId = params.get('hostId');
      const isHost = !remoteHostId;
      
      let myId: string;
      if (isHost) {
          myId = 'ns-' + Math.random().toString(36).substring(2, 8);
          setHostId(myId);
          const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?hostId=${myId}`;
          window.history.replaceState({ path: newUrl }, '', newUrl);
          setShareUrl(newUrl);
      } else {
          myId = 'ns-gst-' + Math.random().toString(36).substring(2, 8);
          setHostId(remoteHostId!); 
          setShareUrl(window.location.href);
      }

      setMyPeerId(myId);
      console.log('Initializing Peer with ID:', myId);

      const peer = new Peer(myId, { debug: 1 });
      peerRef.current = peer;

      peer.on('open', (id) => {
          console.log('Peer Open. My ID:', id);
          if (!isHost && remoteHostId) {
              console.log('I am guest. Connecting to Host:', remoteHostId);
              const conn = peer.connect(remoteHostId, { reliable: true });
              setupConnection(conn);
          }
      });

      peer.on('connection', (conn) => {
          console.log('Incoming connection from:', conn.peer);
          setupConnection(conn);
      });

      peer.on('error', (err) => console.error('PeerJS Error:', err));
    };

    initPeer();

    return () => {
        peerRef.current?.destroy();
    };
  }, [setupConnection]);

  const processReceivedFile = async (file: TransferFile) => {
       if (file.type === FileType.IMAGE || file.type === FileType.TEXT) {
           updateFileState(file.id, { analysisStatus: 'analyzing' });
           try {
               const metaData = await processFileWithGemini(file.fileObject as File, file.type);
               updateFileState(file.id, { analysisStatus: 'completed', metaData });
           } catch (e) {
               updateFileState(file.id, { analysisStatus: 'failed' });
           }
       } else {
           updateFileState(file.id, { analysisStatus: 'skipped' });
       }
  };

  const determineFileType = (mimeType: string, name: string): FileType => {
    if (mimeType.startsWith('image/')) return FileType.IMAGE;
    if (mimeType.startsWith('text/') || mimeType === 'application/json' || name.endsWith('.md')) return FileType.TEXT;
    if (mimeType === 'application/pdf') return FileType.PDF;
    if (mimeType.startsWith('video/')) return FileType.VIDEO;
    return FileType.UNKNOWN;
  };

  const handleFileUpload = async (fileList: FileList) => {
    const newFiles: TransferFile[] = Array.from(fileList).map(file => ({
      id: Math.random().toString(36).substring(7),
      fileObject: file,
      name: file.name,
      size: file.size,
      type: determineFileType(file.type, file.name),
      url: URL.createObjectURL(file),
      timestamp: Date.now(),
      fromDevice: "Me",
      analysisStatus: 'pending',
      transferStatus: 'queued'
    }));

    setFiles(prev => [...newFiles, ...prev]);

    for (const transferFile of newFiles) {
        updateFileState(transferFile.id, { analysisStatus: 'analyzing' });
        try {
            if (transferFile.type === FileType.IMAGE || transferFile.type === FileType.TEXT) {
                 const metaData = await processFileWithGemini(transferFile.fileObject as File, transferFile.type);
                 updateFileState(transferFile.id, { analysisStatus: 'completed', metaData });
            } else {
                 updateFileState(transferFile.id, { analysisStatus: 'skipped' });
            }
        } catch (e) {
            updateFileState(transferFile.id, { analysisStatus: 'failed' });
        }
    }
  };

  const updateFileState = (id: string, updates: Partial<TransferFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleSendFiles = () => {
      // Use ref to get latest devices state
      const targetDevice = devicesRef.current.find(d => d.id === activeDeviceId);
      
      if (!targetDevice || !targetDevice.connection) {
          // This should ideally be prevented by UI, but as a fallback
          console.error("No active device connection found.");
          return;
      }

      const filesToSend = files.filter(f => f.fromDevice === 'Me' && f.transferStatus === 'queued');
      if (filesToSend.length === 0) return;

      filesToSend.forEach(file => {
          updateFileState(file.id, { transferStatus: 'sending' });
          
          try {
            const blob = file.fileObject;
            targetDevice.connection.send({
                type: 'FILE_CHUNK',
                payload: {
                    meta: {
                        id: file.id,
                        name: file.name,
                        type: (file.fileObject as File).type,
                        size: file.size
                    },
                    blob: blob 
                }
            });

            setTimeout(() => {
                updateFileState(file.id, { transferStatus: 'completed' });
            }, 800);
          } catch(err) {
              console.error("Send failed", err);
              updateFileState(file.id, { transferStatus: 'failed' });
          }
      });
  };

  const activeDevice = devices.find(d => d.id === activeDeviceId) || null;

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-200 font-sans overflow-hidden">
        <Sidebar 
            devices={devices} 
            activeDeviceId={activeDeviceId} 
            onSelectDevice={setActiveDeviceId}
            shareUrl={shareUrl} 
        />
        <main className="flex-1 flex flex-col relative min-w-0">
             <TransferArea 
                files={files} 
                onFileUpload={handleFileUpload} 
                activeDevice={activeDevice}
                onSend={handleSendFiles}
             />
        </main>
    </div>
  );
};

export default App;