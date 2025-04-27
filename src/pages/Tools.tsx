import React from 'react';
import { useNavigate } from 'react-router-dom';

const Tools: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px'
        }}>
            <h1>Tools</h1>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginTop: '20px'
            }}>
                <button
                    onClick={() => navigate('/tools/Quotation-Helper')}
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px'
                    }}
                >
                    Quotation Helper
                </button>
            </div>
        </div>
    );
};

export default Tools; 