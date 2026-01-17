import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TransferArea } from './components/TransferArea';
import { ConnectedDevice, DeviceType, FileType, TransferFile, P2PMessage } from './types';
import { processFileWithGemini } from './services/geminiService';
import { Peer } from 'peerjs';

// Helper functions defined outside component to remain stable across renders
const determineFileType = (mimeType: string, name: string): FileType => {
    if (mimeType.startsWith('image/')) return FileType.IMAGE;
    if (mimeType.startsWith('text/') || mimeType === 'application/json' || name.endsWith('.md') || name.endsWith('.txt')) return FileType.TEXT;
    if (mimeType === 'application/pdf') return FileType.PDF;
    if (mimeType.startsWith('video/')) return FileType.VIDEO;
    return FileType.UNKNOWN;
};

const App: React.FC = () => {
  // Session State
  const [hostId, setHostId] = useState<string>('');
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  
  // Device State
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [files, setFiles] = useState<TransferFile[]>([]);
  
  // Refs
  const devicesRef = useRef<ConnectedDevice[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const filesRef = useRef<TransferFile[]>([]);
  const initializedRef = useRef<boolean>(false); // Prevent Strict Mode double-init

  // Sync refs
  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { filesRef.current = files; }, [files]);

  const getMyDeviceType = (): DeviceType => {
      const ua = navigator.userAgent;
      if (/android/i.test(ua)) return DeviceType.ANDROID;
      if (/iPad|iPhone|iPod/.test(ua)) return DeviceType.IOS;
      if (/Win/.test(ua)) return DeviceType.WINDOWS;
      if (/Mac/.test(ua)) return DeviceType.MAC;
      return DeviceType.WINDOWS;
  };

  const getMyDeviceName = (): string => {
      const type = getMyDeviceType();
      const idPart = peerRef.current?.id ? peerRef.current.id.slice(-4) : Math.floor(Math.random() * 1000);
      return `${type} (${idPart})`; 
  };

  const updateFileState = useCallback((id: string, updates: Partial<TransferFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const processReceivedFile = useCallback(async (file: TransferFile) => {
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
  }, [updateFileState]);

  // Main Data Handler
  const handleIncomingData = useCallback((data: P2PMessage, conn: any) => {
      console.log('Received Data:', data.type, 'from', conn.peer);
      
      switch (data.type) {
          case 'HANDSHAKE':
              setDevices(prev => {
                  if (prev.find(d => d.id === conn.peer)) return prev;
                  console.log('✅ Connected to new device:', data.payload.name);
                  const newDevice: ConnectedDevice = {
                      id: conn.peer,
                      name: data.payload.name,
                      type: data.payload.type,
                      status: 'online',
                      connection: conn
                  };
                  return [...prev, newDevice];
              });
              setActiveDeviceId(prev => prev || conn.peer);
              break;

          case 'FILE_CHUNK':
              const { meta, blob } = data.payload;
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
  }, [processReceivedFile]);

  // Connection Setup with improved reliability
  const setupConnection = useCallback((conn: any) => {
      // 1. Setup listeners FIRST
      conn.on('data', (data: P2PMessage) => handleIncomingData(data, conn));
      
      conn.on('close', () => {
          console.log('Connection closed:', conn.peer);
          setDevices(prev => prev.map(d => d.id === conn.peer ? { ...d, status: 'offline' } : d));
      });
      
      conn.on('error', (err: any) => console.error('Connection Error:', err));

      // 2. Define Handshake logic
      const sendHandshake = () => {
          console.log('👋 Sending Handshake to:', conn.peer);
          conn.send({
              type: 'HANDSHAKE',
              payload: {
                  name: getMyDeviceName(),
                  type: getMyDeviceType()
              }
          });
      };

      // 3. Trigger Handshake when open (with slight delay to ensure other side is ready)
      if (conn.open) {
          setTimeout(sendHandshake, 500); 
      } else {
          conn.on('open', () => {
              console.log('Connection Opened:', conn.peer);
              setTimeout(sendHandshake, 500);
          });
      }
  }, [handleIncomingData]);

  // Initialization
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initPeer = async () => {
      const params = new URLSearchParams(window.location.search);
      const remoteHostId = params.get('hostId');
      
      // Strict Mode Protection: 
      // If we don't have a hostId in URL, we are the HOST.
      const isHost = !remoteHostId;
      
      let myId: string;
      if (isHost) {
          myId = 'ns-' + Math.random().toString(36).substring(2, 6); // Short ID
          console.log('👑 I am HOST. My ID:', myId);
          setHostId(myId);
          
          // Update URL
          const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?hostId=${myId}`;
          window.history.replaceState({ path: newUrl }, '', newUrl);
          setShareUrl(newUrl);
      } else {
          myId = 'ns-gst-' + Math.random().toString(36).substring(2, 6);
          console.log('👤 I am GUEST. Connecting to:', remoteHostId);
          setHostId(remoteHostId!); 
          setShareUrl(window.location.href);
      }

      setMyPeerId(myId);

      const peer = new Peer(myId, { debug: 1 });
      peerRef.current = peer;

      peer.on('open', (id) => {
          console.log('✅ PeerJS Ready. ID:', id);
          if (!isHost && remoteHostId) {
              console.log('🔗 Connecting to host...', remoteHostId);
              const conn = peer.connect(remoteHostId, { reliable: true });
              setupConnection(conn);
          }
      });

      peer.on('connection', (conn) => {
          console.log('🔗 Incoming connection from:', conn.peer);
          setupConnection(conn);
      });

      peer.on('error', (err) => {
          console.error('❌ PeerJS Error:', err);
          if (err.type === 'peer-unavailable') {
              alert('Host not found. Please scan the QR code again or check connection.');
          }
      });
    };

    initPeer();

    return () => {
        // Only destroy if we are unmounting for real, but in React Strict Mode this runs immediately.
        // We rely on initializedRef to prevent re-init.
        // peerRef.current?.destroy(); 
    };
  }, [setupConnection]);

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
        // Trigger local analysis
        processReceivedFile(transferFile);
    }
  };

  const handleSendFiles = () => {
      const targetDevice = devicesRef.current.find(d => d.id === activeDeviceId);
      if (!targetDevice || !targetDevice.connection) {
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

            // Optimistic completion
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