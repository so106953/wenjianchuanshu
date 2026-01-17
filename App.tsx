import React, { useState, useEffect, useRef } from 'react';
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
  
  // PeerJS Ref
  const peerRef = useRef<Peer | null>(null);

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
      return `${type} User`; // Simplified
  };

  // Initialize Session & PeerJS
  useEffect(() => {
    const initPeer = async () => {
      // 1. Determine Identity (Host vs Guest)
      const params = new URLSearchParams(window.location.search);
      const remoteHostId = params.get('hostId');
      
      // If no hostId in URL, I am the Host.
      // If there is a hostId, I am a Guest connecting to that Host.
      const isHost = !remoteHostId;
      
      // Generate a short ID if I'm host (for cleaner URLs), or random for guest
      let myId: string;
      if (isHost) {
          // Create a random 6-char ID for the session
          myId = 'ns-' + Math.random().toString(36).substring(2, 8);
          setHostId(myId);
          
          // Update URL so we can share it
          const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?hostId=${myId}`;
          window.history.replaceState({ path: newUrl }, '', newUrl);
          setShareUrl(newUrl);
      } else {
          // Guest ID
          myId = 'ns-guest-' + Math.random().toString(36).substring(2, 8);
          setHostId(remoteHostId!); // I'm connecting to this
          setShareUrl(window.location.href);
      }

      setMyPeerId(myId);

      // 2. Initialize Peer
      const peer = new Peer(myId, {
          debug: 1,
      });
      peerRef.current = peer;

      peer.on('open', (id) => {
          console.log('My Peer ID is: ' + id);
          
          if (!isHost && remoteHostId) {
              // I am a guest, Connect to Host immediately
              connectToPeer(remoteHostId, peer);
          }
      });

      peer.on('connection', (conn) => {
          handleConnection(conn);
      });

      peer.on('error', (err) => {
          console.error('PeerJS Error:', err);
      });
    };

    initPeer();

    return () => {
        peerRef.current?.destroy();
    };
  }, []);

  const connectToPeer = (targetId: string, peerInstance: Peer) => {
      console.log('Connecting to host:', targetId);
      const conn = peerInstance.connect(targetId, {
          metadata: { 
              name: getMyDeviceName(),
              type: getMyDeviceType() 
          }
      });
      handleConnection(conn);
  };

  const handleConnection = (conn: any) => {
      conn.on('open', () => {
          console.log('Connection established with:', conn.peer);
          
          // Send Handshake
          conn.send({
              type: 'HANDSHAKE',
              payload: {
                  name: getMyDeviceName(),
                  type: getMyDeviceType()
              }
          });

          // Add to devices list if not already there
          // We don't have the other person's info until they send HANDSHAKE, 
          // but PeerJS metadata might have it if we initiated.
          
          // Temporary placeholder until handshake received
          // Or if we initiated, we know who we connected to? 
          // Actually, wait for HANDSHAKE for robust info.
      });

      conn.on('data', (data: P2PMessage) => {
          console.log('Received data:', data);
          handleIncomingData(data, conn);
      });
      
      conn.on('close', () => {
          setDevices(prev => prev.map(d => d.id === conn.peer ? { ...d, status: 'offline' } : d));
      });
      
      conn.on('error', (err: any) => console.error('Connection Error:', err));
  };

  const handleIncomingData = (data: P2PMessage, conn: any) => {
      switch (data.type) {
          case 'HANDSHAKE':
              setDevices(prev => {
                  if (prev.find(d => d.id === conn.peer)) return prev;
                  const newDevice: ConnectedDevice = {
                      id: conn.peer,
                      name: data.payload.name,
                      type: data.payload.type,
                      status: 'online',
                      connection: conn
                  };
                  return [...prev, newDevice];
              });
              // Auto-select first device
              setActiveDeviceId(prev => prev || conn.peer);
              break;
          
          case 'FILE_META':
              // Prepare to receive file
              // For simplicity in this React-only demo, we assume the next chunk is the full file (blob)
              // or PeerJS handles binary serialization automatically.
              // We just handle the blob in the next generic data event or wrapped in FILE_CHUNK
              break;

          case 'FILE_CHUNK':
              // data.payload contains { fileMeta, blob }
              const { meta, blob } = data.payload;
              const receivedFile: TransferFile = {
                  id: meta.id,
                  fileObject: new File([blob], meta.name, { type: meta.type }),
                  name: meta.name,
                  size: meta.size,
                  type: determineFileType(meta.type, meta.name),
                  url: URL.createObjectURL(new Blob([blob], { type: meta.type })),
                  timestamp: Date.now(),
                  fromDevice: devices.find(d => d.id === conn.peer)?.name || 'Unknown',
                  analysisStatus: 'pending',
                  transferStatus: 'received'
              };
              
              setFiles(prev => [receivedFile, ...prev]);
              
              // Trigger auto-analysis for received files
              processReceivedFile(receivedFile);
              break;
      }
  };

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

    // Process local files with Gemini immediately
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
            console.error(e);
            updateFileState(transferFile.id, { analysisStatus: 'failed' });
        }
    }
  };

  const updateFileState = (id: string, updates: Partial<TransferFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleSendFiles = () => {
      const targetDevice = devices.find(d => d.id === activeDeviceId);
      if (!targetDevice || !targetDevice.connection) {
          alert("Please select a connected device to send files.");
          return;
      }

      const filesToSend = files.filter(f => f.fromDevice === 'Me' && f.transferStatus === 'queued');
      if (filesToSend.length === 0) return;

      filesToSend.forEach(file => {
          updateFileState(file.id, { transferStatus: 'sending' });
          
          const conn = targetDevice.connection;
          const blob = file.fileObject; // This is a File object

          // Send data
          conn.send({
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

          // Simulate slight delay for UI feedback
          setTimeout(() => {
              updateFileState(file.id, { transferStatus: 'completed' });
          }, 800);
      });
  };

  const activeDevice = devices.find(d => d.id === activeDeviceId) || null;

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-200 font-sans overflow-hidden">
        
        {/* Sidebar */}
        <Sidebar 
            devices={devices} 
            activeDeviceId={activeDeviceId} 
            onSelectDevice={setActiveDeviceId}
            shareUrl={shareUrl} 
        />

        {/* Main Content */}
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