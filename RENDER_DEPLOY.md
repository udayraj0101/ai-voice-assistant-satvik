# Deploying to Render

Follow these steps to deploy the AI Voice Assistant to Render:

## 1. Create a Render Account

If you don't have one already, sign up for a free account at [render.com](https://render.com).

## 2. Connect Your GitHub Repository

1. Push your project to GitHub
2. In the Render dashboard, click "New" and select "Blueprint"
3. Connect your GitHub account and select your repository
4. Render will automatically detect the `render.yaml` file

## 3. Configure Environment Variables

1. In the Render dashboard, navigate to your service
2. Go to the "Environment" tab
3. Add your `OPENAI_API_KEY` environment variable
4. Save changes

## 4. Deploy

1. Render will automatically deploy your application
2. You can view build logs in the "Logs" tab
3. Once deployed, you can access your application at the provided URL

## 5. Verify Deployment

1. Visit your application URL
2. Test the AI Voice Assistant functionality
3. Check the logs if you encounter any issues

## Troubleshooting

- If you encounter build errors, check the build logs in the Render dashboard
- Ensure your OpenAI API key is correctly set in the environment variables
- Make sure your API key has access to the GPT-4o Realtime model