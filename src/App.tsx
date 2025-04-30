import { Layout } from '@douyinfe/semi-ui';
import '@douyinfe/semi-ui/dist/css/semi.min.css';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Home from './pages/Home';
// import QuotationHelper from './pages/QuotationHelper';
// import Tools from './pages/Tools';

const { Content } = Layout;

function App() {
    return (
        <Router>
            <Layout style={{ height: '100vh' }}>
                <Content>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        {/* <Route path="/tools" element={<Tools />} />
                        <Route path="/tools/Quotation-Helper" element={<QuotationHelper />} /> */}
                    </Routes>
                </Content>
            </Layout>
        </Router>
    );
}

export default App; 