class GarbageCollector {
    static init() {

        setInterval(() => {
            if (global.gc) {
                global.gc();
                console.log('🗑️ A szemétgyűjtés befejeződött');
            }
        }, 600000);
        
   
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            
            if (memMB > 150) { 
                console.warn(`⚠️ Memory usage: ${memMB}MB`);
                
                if (global.gc) {
                    global.gc();
                    console.log('🗑️ Kényszerű szemétgyűjtés a magas memóriahasználat miatt');
                }
            }
        }, 300000);
    }
    
    static forceCleanup() {
        if (global.gc) {
            global.gc();
            console.log('🗑️ Kézi szemétgyűjtés');
        }
    }
}

module.exports = GarbageCollector;

