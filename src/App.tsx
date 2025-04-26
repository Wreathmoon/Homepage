import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Home from './pages/Home';
import QuotationHelper from './pages/QuotationHelper';
import Tools from './pages/Tools';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/tools/Quotation-Helper" element={<QuotationHelper />} />
            </Routes>
        </Router>
    );
}

export default App; 