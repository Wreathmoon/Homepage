import React from 'react';
import { Layout } from '@douyinfe/semi-ui';
import '@douyinfe/semi-ui/dist/css/semi.min.css';
import './styles/global.css';
import { Route, BrowserRouter as Router, Routes, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import QuotationHelper from './pages/QuotationHelper';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const { Content } = Layout;



// 受保护的应用组件
const ProtectedApp = () => {
    const { isAuthenticated, login } = useAuth();

    if (!isAuthenticated) {
        return <Login onLogin={login} />;
    }

    return (
        <Layout style={{ height: '100vh' }}>
            <Content>
                <Routes>
                    <Route path="/" element={<QuotationHelper />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Content>
        </Layout>
    );
};

function App() {
    // 全局处理 ResizeObserver 错误
    useEffect(() => {
        const handleError = (event: Event) => {
            if (event instanceof ErrorEvent && event.message.includes('ResizeObserver')) {
                event.stopPropagation();
                event.preventDefault();
            }
        };

        window.addEventListener('error', handleError as EventListener);
        return () => window.removeEventListener('error', handleError as EventListener);
    }, []);

    return (
        <AuthProvider>
            <Router>
                <ProtectedApp />
            </Router>
        </AuthProvider>
    );
}

export default App; 