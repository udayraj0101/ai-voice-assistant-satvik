import { useState, useEffect } from "react";

export default function CallSummary() {
  const [callSummary, setCallSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCallSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/call-summary');
      const data = await response.json();
      setCallSummary(data);
    } catch (error) {
      console.error('Error fetching call summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallSummary();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Call Summary</h1>
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Call Summary</h1>
          <button 
            onClick={fetchCallSummary}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {callSummary ? (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-800">Total Calls</h3>
                <p className="text-3xl font-bold text-blue-600">{callSummary.totalCalls}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800">Total Duration</h3>
                <p className="text-3xl font-bold text-green-600">{callSummary.totalDuration} min</p>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-800">Total Cost</h3>
                <p className="text-3xl font-bold text-purple-600">${callSummary.totalCost}</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-orange-800">Avg Cost/Call</h3>
                <p className="text-3xl font-bold text-orange-600">${callSummary.avgCost}</p>
              </div>
            </div>

            {/* Recent Calls */}
            <div className="bg-white border rounded-lg">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Recent Calls</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {callSummary.recentCalls.map((call, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">
                          {call.sessionId.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(call.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {call.duration} min
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          ${call.estimatedCost}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            call.status === 'user-ended' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {call.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {call.userIP}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No call data available</p>
          </div>
        )}
      </div>
    </div>
  );
}