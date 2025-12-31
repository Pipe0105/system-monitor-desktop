import { useEffect, useState } from "react";

function App() {
  const [cpu, setCpu] = useState("0");
  const [ram, setRam] = useState("0");

  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await window.api.getSystemInfo();
      setCpu(data.cpu);
      setRam(data.ram);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>System Monitor</h1>
      <p>CPU Usage: {cpu}%</p>
      <p>RAM Usage: {ram}%</p>
    </div>
  );
}

export default App;
