import { Layout } from '@douyinfe/semi-ui';
import '@douyinfe/semi-ui/dist/css/semi.min.css';
import { Route, BrowserRouter as Router, Routes, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home';
import Portal from './pages/Portal';
import Tools from './pages/Tools';
import Contact from './pages/Contact';
import QuotationHelper from './pages/QuotationHelper';
import { ResizeObserverFix } from './utils/resizeObserver';

const { Content } = Layout;

function App() {
    // 应用 ResizeObserver 修复
    useEffect(() => {
        ResizeObserverFix.apply();
        return () => {
            ResizeObserverFix.release();
        };
    }, []);

    return (
        <Router>
            <Layout style={{ height: '100vh' }}>
                <Content>
                    <Routes>
                        <Route path="/" element={<Navigate to="/home" replace />} />
                        <Route path="/home" element={<Home />} />
                        <Route path="/portal" element={<Portal />} />
                        <Route path="/tools" element={<Tools />} />
                        <Route path="/tools/quotationhelper" element={<QuotationHelper />} />
                        <Route path="/contact" element={<Contact />} />
                    </Routes>
                </Content>
            </Layout>
        </Router>
    );
}

export default App; 