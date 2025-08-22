const config = {
  getUrl: 'https://h0rmkmihk4.execute-api.ap-south-1.amazonaws.com/vlogs/getData',
  postUrl: 'https://h0rmkmihk4.execute-api.ap-south-1.amazonaws.com/vlogs/postData'
};

// Generic API call 
async function apiFetch(url, opts = {}) {
  const headers = opts.headers || {};
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';

  const res = await fetch(url, {
    ...opts,
    headers
  });
  return res.json();
}

// Create post
async function createPost(postData) {
  return apiFetch(config.postUrl, {
    method: 'POST',
    body: JSON.stringify(postData)
  });
}

// Get posts
async function getPosts() {
  return apiFetch(config.getUrl, {
    method: 'GET'
  });
}
