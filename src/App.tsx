import '@douyinfe/semi-ui/dist/css/semi.min.css';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import Home from './pages/Home';
import QuotationHelper from './pages/QuotationHelper';
import Tools from './pages/Tools';

function App() {
    return (
        <Router>
            <div className="app">
                <Header />
                <div className="content">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/tools" element={<Tools />} />
                        <Route path="/tools/Quotation-Helper" element={<QuotationHelper />} />
                    </Routes>
                </div>
            </div>
        </Router>
    );
}

export default App; 