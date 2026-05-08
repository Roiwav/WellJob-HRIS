import React from 'react';

const MaintenancePage = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            <h1 className="text-4xl font-bold text-red-600 mb-4">System Under Maintenance</h1>
            <p className="text-lg text-gray-700">System is currently under maintenance. Please try again later.</p>
        </div>
    );
};

export default MaintenancePage;