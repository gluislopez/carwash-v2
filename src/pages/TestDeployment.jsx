import React from 'react';

const TestDeployment = () => {
    return (
        <div style={{ padding: '2rem', color: 'white', textAlign: 'center' }}>
            <h1 style={{ color: '#10B981' }}>✅ DEPLOYMENT WORKING v3.53</h1>
            <p>Si ves esto, la nueva versión se ha desplegado correctamente.</p>
            <p>Hora: {new Date().toLocaleTimeString()}</p>
        </div>
    );
};

export default TestDeployment;
