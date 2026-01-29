import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Report() {
  const [report, setReport] = useState('');
  const [pdfBase64, setPdfBase64] = useState('');
  const [loading, setLoading] = useState(true);
  const sessionId = localStorage.getItem('session_id');
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    const fetchReport = async () => {
      try {
        const res = await axios.post('/api/report', {
          session_id: sessionId
        });
        
        console.log('Report response:', res.data);
        
        if (res.data.pdf_base64) {
          setReport('PDF report generated successfully');
          setPdfBase64(res.data.pdf_base64);
        } else {
          setReport(res.data.report || 'No report available');
        }
      } catch (error) {
        console.error("Error fetching report:", error);
        setReport("Failed to generate report.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [sessionId, navigate]);

  const downloadPDF = () => {
    if (!pdfBase64) {
      alert('PDF not available');
      return;
    }

    try {
      // Create download link
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfBase64}`;
      link.download = `Interview_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem'
      }}>
        Generating report...
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '2rem',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto',
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          color: '#333', 
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          Interview Report
        </h1>
        
        <div style={{ 
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: '#e3f2fd',
          borderRadius: '5px'
        }}>
          <p><strong>Session ID:</strong> {sessionId}</p>
          <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
        </div>

        {pdfBase64 ? (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ 
              color: '#4caf50', 
              fontSize: '1.1rem',
              marginBottom: '1rem'
            }}>
              ✅ PDF Report Generated Successfully
            </p>
            <button
              onClick={downloadPDF}
              style={{
                padding: '1rem 2rem',
                backgroundColor: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              📄 Download PDF Report
            </button>
          </div>
        ) : (
          <div style={{ 
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#fff3e0',
            borderRadius: '5px'
          }}>
            <p style={{ color: '#f57c00' }}>
              ⚠️ PDF generation failed. Showing text report below:
            </p>
          </div>
        )}

        <div style={{ 
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.6'
        }}>
          {report}
        </div>
      </div>
    </div>
  );
}

export default Report;
