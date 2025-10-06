"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Send,
  Bot,
  FileText,
  ArrowUp,
  ArrowDown
} from "lucide-react"
import {
  getAllAnalyticsDataAction,
  getCompletePatientRecordsAction,
  type ClinicStatistics,
  type TreatmentDistribution,
  type PatientDemographics
} from "@/lib/actions/analytics"

interface AnalyticsData {
  statistics: ClinicStatistics | null;
  treatmentDistribution: TreatmentDistribution[];
  patientDemographics: PatientDemographics[];
}

interface StatisticCardProps {
  title: string;
  value: string | number;
  growth: number;
  icon: React.ReactNode;
  prefix?: string;
  suffix?: string;
}

// Colors for charts matching ENDOFLOW theme
const CHART_COLORS = ['#009688', '#26a69a', '#4db6ac', '#80cbc4', '#b2dfdb', '#e0f2f1'];

function StatisticCard({ title, value, growth, icon, prefix = '', suffix = '' }: StatisticCardProps) {
  const isPositive = growth >= 0;
  const GrowthIcon = isPositive ? ArrowUp : ArrowDown;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-bold text-gray-900">
                {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
              </span>
            </div>
            <div className={`flex items-center text-sm ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <GrowthIcon className="w-4 h-4 mr-1" />
              <span>{Math.abs(growth).toFixed(1)}% from last month</span>
            </div>
          </div>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-100">
            <div className="text-teal-600">
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ClinicalResearchChatProps {
  onSendMessage: (message: string) => void;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  isLoading: boolean;
}

function ClinicalResearchChat({ onSendMessage, messages, isLoading }: ClinicalResearchChatProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Clinical Research Assistant</CardTitle>
            <p className="text-sm text-gray-500">AI-powered clinical insights</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow flex flex-col p-0">
        {/* Messages Area */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-1">Hello! I'm your Clinical Research Assistant.</p>
                <p className="text-sm text-gray-400">
                  I can help you analyze your clinical data, provide insights on treatment outcomes,
                  and answer questions about evidence-based practices. What would you like to know?
                </p>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="text-sm">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-teal-100' : 'text-gray-500'
                }`}>
                  {message.timestamp}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm text-gray-600">Analyzing clinical data...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your clinical data, treatment outcomes, evidence-based practices..."
              className="flex-grow"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              className="bg-teal-600 hover:bg-teal-700"
              disabled={!input.trim() || isLoading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClinicAnalysis() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [patientRecords, setPatientRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());

  // Memoized analytics data for performance
  const memoizedAnalyticsData = useMemo(() => analyticsData, [analyticsData]);

  // Memoized derived data
  const statistics = useMemo(() => memoizedAnalyticsData?.statistics, [memoizedAnalyticsData]);
  const treatmentData = useMemo(() => memoizedAnalyticsData?.treatmentDistribution || [], [memoizedAnalyticsData]);
  const demographicsData = useMemo(() => memoizedAnalyticsData?.patientDemographics || [], [memoizedAnalyticsData]);

  // Memoized chart components for performance
  const TreatmentChart = useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={treatmentData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="treatmentType"
          fontSize={12}
          tick={{ fill: '#6b7280' }}
        />
        <YAxis fontSize={12} tick={{ fill: '#6b7280' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px'
          }}
        />
        <Bar dataKey="count" fill="#009688" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  ), [treatmentData]);

  const DemographicsChart = useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={demographicsData}
          cx="50%"
          cy="50%"
          outerRadius={80}
          fill="#8884d8"
          dataKey="count"
          label={({ ageGroup, percentage }) => `${ageGroup}: ${percentage}%`}
        >
          {demographicsData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  ), [demographicsData]);

  // Optimized data loading function
  const loadAnalyticsData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch both aggregate analytics AND complete patient records
      const [analyticsResult, patientsResult] = await Promise.all([
        getAllAnalyticsDataAction(),
        getCompletePatientRecordsAction()
      ]);

      if (analyticsResult.success && analyticsResult.data) {
        setAnalyticsData(analyticsResult.data);
      } else {
        console.error('Failed to load analytics data:', analyticsResult.error);
      }
      
      if (patientsResult.success && patientsResult.data) {
        setPatientRecords(patientsResult.data);
        console.log(`📈 [CLINIC-ANALYSIS] Loaded ${patientsResult.data.length} complete patient records`);
      } else {
        console.error('Failed to load patient records:', patientsResult.error);
      }
      
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Optimized message handling with caching
  const handleSendMessage = useCallback(async (message: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add user message
    setChatMessages(prev => [...prev, { role: 'user', content: message, timestamp }]);
    setIsChatLoading(true);

    try {
      // Call the research AI query endpoint WITHOUT RAG (patient data only)
      const response = await fetch('/api/research/ai-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          analysisType: 'clinic_analysis', // Different type to skip RAG
          cohortData: patientRecords, // Send complete patient records with all clinical data
          disableRAG: true, // Explicitly disable RAG
          context: {
            currentStats: memoizedAnalyticsData?.statistics,
            treatmentData: memoizedAnalyticsData?.treatmentDistribution,
            demographics: memoizedAnalyticsData?.patientDemographics
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const result = await response.json();
      const responseTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (result.success && result.response) {
        // Format response with citations if available
        let responseContent = typeof result.response === 'string' 
          ? result.response 
          : result.response.summary || JSON.stringify(result.response, null, 2);
        
        // Add citations if evidence was found
        if (result.hasEvidence && result.citations && result.citations.length > 0) {
          responseContent += '\n\n**References:**\n';
          result.citations.forEach((citation: any, index: number) => {
            responseContent += `\n[${index + 1}] ${citation.title}${citation.authors ? ` - ${citation.authors}` : ''}${citation.year ? ` (${citation.year})` : ''}`;
          });
        }
        
        // Add source badge (no evidence badge for clinic analysis)
        const sourceBadge = ' 📊 *Clinic data analysis*';
        
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: responseContent + sourceBadge,
          timestamp: responseTimestamp
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please try again.',
          timestamp: responseTimestamp
        }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const responseTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I\'m currently unable to process your request. Please try again later.',
        timestamp: responseTimestamp
      }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [memoizedAnalyticsData, patientRecords]);

  // Real-time data refresh every 5 minutes
  useEffect(() => {
    loadAnalyticsData();

    const refreshInterval = setInterval(() => {
      console.log('🔄 [ANALYTICS] Auto-refreshing clinic data...');
      loadAnalyticsData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, [loadAnalyticsData]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-48"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
          <div className="h-9 bg-gray-200 rounded w-32"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinic Analytics</h1>
          <div className="flex items-center space-x-4">
            <p className="text-gray-500">Comprehensive insights into your practice performance</p>
            <div className="flex items-center text-sm text-gray-400">
              <Activity className="w-4 h-4 mr-1" />
              <span>Last updated: {lastRefreshTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalyticsData}
            disabled={isLoading}
          >
            <Activity className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={loadAnalyticsData}
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatisticCard
          title="Total Patients"
          value={statistics?.totalPatients || 1234}
          growth={statistics?.totalPatientsGrowth || 12}
          prefix=""
          icon={<Users className="w-6 h-6" />}
        />
        <StatisticCard
          title="Monthly Revenue"
          value={statistics?.monthlyRevenue || 45231}
          growth={statistics?.monthlyRevenueGrowth || 8}
          prefix="₹"
          icon={<DollarSign className="w-6 h-6" />}
        />
        <StatisticCard
          title="Appointments"
          value={statistics?.totalAppointments || 892}
          growth={statistics?.appointmentsGrowth || 15}
          icon={<Calendar className="w-6 h-6" />}
        />
        <StatisticCard
          title="Success Rate"
          value={statistics?.successRate || 94.2}
          growth={statistics?.successRateGrowth || 2.1}
          suffix="%"
          icon={<Activity className="w-6 h-6" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Treatment Distribution Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-teal-600" />
                Treatment Distribution
              </CardTitle>
              <p className="text-sm text-gray-500">Most common procedures this month</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {TreatmentChart}
            </div>
            <div className="mt-4 text-center text-sm text-gray-500">
              {treatmentData.length > 0 && (
                <span>
                  Root Canals: {treatmentData[0]?.percentage || 45}% |
                  Fillings: {treatmentData[1]?.percentage || 30}% |
                  Cleanings: {treatmentData[2]?.percentage || 25}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Patient Demographics Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center">
                <PieChartIcon className="w-5 h-5 mr-2 text-teal-600" />
                Patient Demographics
              </CardTitle>
              <p className="text-sm text-gray-500">Age distribution of patients</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {DemographicsChart}
            </div>
            <div className="mt-4 text-center text-sm text-gray-500">
              {demographicsData.length > 0 && (
                <span>
                  18-30: {demographicsData.find(d => d.ageGroup === '18-30')?.percentage || 25}% |
                  31-50: {demographicsData.find(d => d.ageGroup === '31-50')?.percentage || 40}% |
                  51+: {demographicsData.find(d => d.ageGroup === '51+')?.percentage || 35}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clinical Research Assistant */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Clinical Research Assistant</h2>
          <p className="text-gray-500">Ask questions about your clinical data, treatment outcomes, and evidence-based practices</p>
        </div>
        <ClinicalResearchChat
          onSendMessage={handleSendMessage}
          messages={chatMessages}
          isLoading={isChatLoading}
        />
      </div>
    </div>
  );
}