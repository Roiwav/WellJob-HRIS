import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SystemMaintenance = () => {
    // Default state
    const [isMaintenanceOn, setIsMaintenanceOn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // --- NEW: Kukunin ang totoong status mula sa database pag-load ng page ---
    useEffect(() => {
        const fetchMaintenanceStatus = async () => {
            try {
                // Palitan ang URL kung gumagamit ka ng proxy sa Vite
                const response = await axios.get('http://localhost:5000/api/settings/maintenance-status');
                
                // I-set ang button depende sa nakuha sa database
                setIsMaintenanceOn(response.data.isMaintenanceOn);
            } catch (error) {
                console.error("Error fetching maintenance status:", error);
            } finally {
                setIsLoading(false); // Tapos na mag-load
            }
        };

        fetchMaintenanceStatus();
    }, []);
    // -------------------------------------------------------------------------

    const toggleMaintenanceMode = async () => {
        const confirmMsg = isMaintenanceOn 
            ? "Gusto mo bang i-turn OFF ang maintenance at papasukin na ulit ang ibang users?" 
            : "Sigurado ka ba? I-la-lock nito ang system at maba-block ang lahat maliban sa IT Support.";
            
        if (!window.confirm(confirmMsg)) return;

        try {
            await axios.post('http://localhost:5000/api/settings/toggle-maintenance', {
                status: !isMaintenanceOn
            });
            setIsMaintenanceOn(!isMaintenanceOn);
            alert("System Maintenance Mode Updated!");
        } catch (error) {
            console.error("Error toggling maintenance mode", error);
            alert("May error sa pag-update ng maintenance status.");
        }
    };

    // Habang kinukuha pa sa database ang status, magpapakita muna ng loading
    if (isLoading) {
        return <div className="p-6 text-gray-600">Loading system settings...</div>;
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">System Maintenance Control</h1>
            <div className="p-6 border rounded bg-white shadow-sm max-w-lg">
                <h3 className="font-bold text-lg text-red-600 mb-2">Danger Zone</h3>
                <p className="text-sm text-gray-600 mb-6">
                    Kapag naka-ON ito, ang system ay magiging offline para sa lahat ng users (HR Staff, HR Manager, at Super Admin). 
                    Tanging ang Technical IT Support lamang ang may access.
                </p>
                <button 
                    onClick={toggleMaintenanceMode}
                    className={`px-6 py-3 font-bold rounded text-white transition-colors ${
                        isMaintenanceOn 
                        ? 'bg-green-500 hover:bg-green-600' 
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                >
                    {isMaintenanceOn ? 'Turn Maintenance OFF' : 'Turn Maintenance ON'}
                </button>
            </div>
        </div>
    );
};

export default SystemMaintenance;