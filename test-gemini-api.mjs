import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = 'AIzaSyDWpUU2GkXSMNxrn-CanK0Si4Gq3Ko2ZM4'

console.log('🤖 Testing Gemini API Connection...')
console.log('API Key:', GEMINI_API_KEY.substring(0, 20) + '...')

try {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1024,
    }
  })

  console.log('\n📡 Sending test request to Gemini API...')

  const prompt = 'Respond with a single word: "SUCCESS"'
  const result = await model.generateContent(prompt)
  const responseText = result.response.text()

  console.log('✅ API Response:', responseText)
  console.log('✅ Gemini API is working correctly!')

} catch (error) {
  console.error('❌ Error testing Gemini API:')
  console.error('Error name:', error.name)
  console.error('Error message:', error.message)

  if (error.cause) {
    console.error('Error cause:', error.cause)
  }

  if (error.message.includes('API key')) {
    console.error('\n⚠️  API KEY ISSUE: The API key may be invalid or expired.')
    console.error('Get a new key at: https://aistudio.google.com/app/apikey')
  } else if (error.message.includes('fetch failed')) {
    console.error('\n⚠️  NETWORK ISSUE: Cannot reach Google API servers.')
    console.error('Check your internet connection or firewall settings.')
  } else if (error.message.includes('quota')) {
    console.error('\n⚠️  QUOTA EXCEEDED: API usage limits reached.')
  }

  process.exit(1)
}
