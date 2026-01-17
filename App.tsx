import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TransferArea } from './components/TransferArea';
import { ConnectedDevice, DeviceType, FileType, TransferFile } from './types';
import { processFileWithGemini } from './services/geminiService';

const App: React.FC = () => {
  // Session State
  const [roomId, setRoomId] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  
  // Device State
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [files, setFiles] = useState<TransferFile[]>([]);

  // Initialize Session
  useEffect(() => {
    const initSession = () => {
      // Check URL for existing room
      const params = new URLSearchParams(window.location.search);
      let currentRoom = params.get('room');
      const isGuest = !!currentRoom;

      if (!currentRoom) {
        // Create new room ID if hosting
        currentRoom = Math.random().toString(36).substring(2, 8) + '-' + Math.random().toString(36).substring(2, 8);
        const newUrl = `${window.location.pathname}?room=${currentRoom}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
      }

      setRoomId(currentRoom);
      setShareUrl(window.location.href);

      // Setup initial devices mock based on connection type
      if (isGuest) {
          // If I joined a link, I see the Host
          setDevices([
              { id: 'host', name: "Host Device", type: DeviceType.WINDOWS, status: 'online', ip: '10.0.0.1' }
          ]);
          setActiveDeviceId('host');
      } else {
          // If I am host, I wait for connections (Simulation)
          // simulating a device connecting after 3 seconds for demo purposes
          setTimeout(() => {
            const newDevice: ConnectedDevice = { 
                id: 'guest-1', 
                name: "Remote Mobile", 
                type: DeviceType.ANDROID, 
                status: 'online', 
                ip: 'Remote' 
            };
            setDevices(prev => [...prev, newDevice]);
            if (!activeDeviceId) setActiveDeviceId(newDevice.id);
          }, 3000);
      }
    };

    initSession();
  }, []);

  const activeDevice = devices.find(d => d.id === activeDeviceId) || null;

  const determineFileType = (file: File): FileType => {
    if (file.type.startsWith('image/')) return FileType.IMAGE;
    if (file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.md')) return FileType.TEXT;
    if (file.type === 'application/pdf') return FileType.PDF;
    if (file.type.startsWith('video/')) return FileType.VIDEO;
    return FileType.UNKNOWN;
  };

  const handleFileUpload = async (fileList: FileList) => {
    // Allow upload even if no device selected (self-storage/processing)
    const currentDeviceName = activeDevice ? activeDevice.name : "My Storage";

    const newFiles: TransferFile[] = Array.from(fileList).map(file => ({
      id: Math.random().toString(36).substring(7),
      fileObject: file,
      name: file.name,
      size: file.size,
      type: determineFileType(file),
      url: URL.createObjectURL(file),
      timestamp: Date.now(),
      fromDevice: "Me", // Sent by me
      analysisStatus: 'pending' 
    }));

    setFiles(prev => [...newFiles, ...prev]);

    // Process with Gemini
    for (const transferFile of newFiles) {
        updateFileStatus(transferFile.id, 'analyzing');

        try {
            if (transferFile.type === FileType.IMAGE || transferFile.type === FileType.TEXT) {
                 const metaData = await processFileWithGemini(transferFile.fileObject, transferFile.type);
                 
                 setFiles(prev => prev.map(f => {
                    if (f.id === transferFile.id) {
                        return {
                            ...f,
                            analysisStatus: 'completed',
                            metaData
                        };
                    }
                    return f;
                 }));
            } else {
                 updateFileStatus(transferFile.id, 'skipped');
            }
        } catch (e) {
            console.error(e);
            updateFileStatus(transferFile.id, 'failed');
        }
    }
  };

  const updateFileStatus = (id: string, status: TransferFile['analysisStatus']) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, analysisStatus: status } : f));
  };

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-200 font-sans overflow-hidden">
        
        {/* Sidebar */}
        <Sidebar 
            devices={devices} 
            activeDeviceId={activeDeviceId} 
            onSelectDevice={setActiveDeviceId}
            shareUrl={shareUrl} // Pass the generated room URL
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative min-w-0">
             <TransferArea 
                files={files} 
                onFileUpload={handleFileUpload} 
                activeDevice={activeDevice}
             />
        </main>
    </div>
  );
};

export default App;