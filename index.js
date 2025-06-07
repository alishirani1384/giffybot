import express from "express";
import { App } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import axios from "axios";
import { configDotenv } from "dotenv";

configDotenv();

const app = express();
const port = process.env.PORT || 3000;

const githubApp = new App({
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY,
  webhooks: {
    secret: process.env.WEBHOOK_SECRET,
  },
});

githubApp.webhooks.on('issue_comment.created', async ({ octokit, payload }) => {
    console.log('Received an issue comment event.');
  
    const commentBody = payload.comment.body;
    const triggerPhrase = '/gif';
  
    // Ignore comments that don't start with the trigger phrase or are from the bot itself
    if (!commentBody.startsWith(triggerPhrase) || payload.sender.type === 'Bot') {
      console.log('Comment did not contain trigger phrase or was from a bot. Ignoring.');
      return;
    }
  
    const searchQuery = commentBody.substring(triggerPhrase.length).trim();
    if (!searchQuery) {
      console.log('No search query provided. Ignoring.');
      return;
    }
    
    console.log(`Searching for a GIF with query: "${searchQuery}"`);
  
    try {
      // --- 3. FETCH A GIF FROM GIPHY ---
      const giphyResponse = await axios.get(
        `https://api.giphy.com/v1/gifs/search`,
        {
          params: {
            api_key: process.env.GIPHY_API_KEY,
            q: searchQuery,
            limit: 1,
            rating: 'g',
          },
        }
      );
  
      let issueCommentBody;
  
      if (giphyResponse.data.data.length === 0) {
        console.log('No GIF found for the query.');
        issueCommentBody = `Sorry, I couldn't find a GIF for "${searchQuery}".`;
      } else {
        const gifUrl = giphyResponse.data.data[0].images.downsized.url;
        const gifTitle = giphyResponse.data.data[0].title;
        issueCommentBody = `**${searchQuery}**\n\n![${gifTitle}](${gifUrl})`;
      }
      
      await octokit.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        body: issueCommentBody,
      });
      
      console.log('Successfully posted a comment to the issue.');
  
    } catch (error) {
      console.error('An error occurred:', error);
    }
  });

const middleware = createNodeMiddleware(githubApp.webhooks, { path: '/api/github/webhooks' });

app.use(middleware);

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('An internal error occurred.');
});

export default app;
