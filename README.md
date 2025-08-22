# VlogSpace--a-place-to-write-your-own-story
The VlogSpace project is a web application that allows users to write, publish, and browse vlogs 
stored in an AWS DynamoDB table. The application includes: 
• A home page (index.html) introducing the platform and providing navigation to browse 
and create vlogs. 
• A create vlog page (create.html) with form fields for title, content, and author. 
• A view vlogs page (view.html) that lists all published vlogs in reverse chronological order. 
The front-end is hosted on Amazon S3 and integrated with AWS Amplify for deployment. It is 
secured and accelerated with Amazon CloudFront, and communicates with AWS Lambda 
functions through Amazon API Gateway for serverless backend operations.

**Now to intregate this project with AWS follow the below steps:**

**Setup in AWS Console:**
1.	Create a DynamoDB table Vlogs with id as the Partition key , set id as number.
2.	Create these two Lambda functions and set TABLE_NAME environment variable to Vlogs.
3.	Add IAM role to Lambda with AmazonDynamoDBFullAccess.

We’ll make two Lambda functions:
1. Create Post Lambda (POST /posts1):
**Lamda post:**

import json
import boto3
import os
import time
#DynamoDB setup
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'Vlogs')
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    print(f"Lambda function started. Table name: {table_name}")
    print(f"Full event received: {json.dumps(event)}")
    
    try:
        # Parse request body
        if "body" in event:
            if isinstance(event["body"], str):
                body = json.loads(event["body"])
            else:
                body = event["body"]
        else:
            body = event
            
        print(f"Parsed request body: {json.dumps(body, default=str)}")

        # Extract basic fields
        title = body.get("title", "Untitled")
        content = body.get("content", "No content")
        author = body.get("author", "guest")
        
        # Generate unique ID
        post_id = int(time.time() * 1000)
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"Creating post with ID: {post_id}")

        # Create the item to insert
        item = {
            'id': post_id,
            'title': str(title),
            'content': str(content),
            'author': str(author),
            'timestamp': timestamp
        }

        # Handle image - try to store it, but don't fail if it doesn't work
        has_image = False
        try:
            if body.get('image') and len(body.get('image', '')) > 0:
                print(f"Image data found, length: {len(body['image'])}")
                
                # Only store if image is reasonably small
                if len(body['image']) < 300000:  # ~300KB limit
                    item['image'] = str(body['image'])
                    item['imageType'] = str(body.get('imageType', 'image/jpeg'))
                    item['hasImage'] = True
                    has_image = True
                    print("Image stored successfully")
                else:
                    print(f"Image too large ({len(body['image'])} chars), skipping")
                    item['hasImage'] = False
            else:
                print("No image data found")
                item['hasImage'] = False
        except Exception as img_error:
            print(f"Image processing error (non-fatal): {img_error}")
            item['hasImage'] = False

        print(f"Final item to store: {json.dumps({k: v if k != 'image' else f'[IMAGE_DATA_{len(str(v))}_CHARS]' for k, v in item.items()})}")

        # Store in DynamoDB
        response = table.put_item(Item=item)
        print(f"DynamoDB put_item response: {response}")

        # Return success
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'message': 'Vlog created successfully!',
                'id': post_id,
                'title': title,
                'author': author,
                'hasImage': has_image,
                'timestamp': timestamp
            })
        }

    except Exception as e:
        print(f"ERROR: {str(e)}")
        
        # Import traceback for detailed error info
        import traceback
        print(f"Full error traceback: {traceback.format_exc()}")
        
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': False,
                'error': 'Internal server error',
                'message': str(e),
                'details': 'Check CloudWatch logs for more information'
            })
        }
---------------------------------------------------------------------------------------------------
**Event(example):**
{
    "id": 1,
    "title": "Sample Title",
    "content": "Sample content for testing",
    "author": "test_user",
    "timestamp": "2025-08-10 20:30:00"
}

-----------------------------------------------------------------------------------------------------
**2. Get Posts Lambda (GET /posts2):**
# Lamda Get:

import boto3
import json
from decimal import Decimal
import os
def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('TABLE_NAME', 'Vlogs'))

def lambda_handler(event, context):
    try:
        # Scan the table to get all posts
        response = table.scan()
        posts = response['Items']
        
        # Handle pagination if there are many posts
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            posts.extend(response['Items'])
        
        # Sort posts by timestamp (newest first)
        posts.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        # Process each post to ensure image handling
        processed_posts = []
        for post in posts:
            processed_post = dict(post)
            
            # Ensure hasImage field exists
            if 'hasImage' not in processed_post:
                processed_post['hasImage'] = bool(processed_post.get('image') or processed_post.get('imageUrl'))
            
            # If we have an S3 URL but no base64 image, we could optionally fetch it
            # For now, we'll just pass through what we have
            
            processed_posts.append(processed_post)
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
            },
            "body": json.dumps({"posts": processed_posts}, default=decimal_default)
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
            },
            "body": json.dumps({
                "error": "Failed to fetch posts",
                "message": str(e)
            })
        }
-------------------------------------------------------------------------------------------------------------
# Event(example):
{
    "id": 1,
    "title": "Sample Title",
    "content": "Sample content for testing",
    "author": "test_user",
    "timestamp": "2025-08-10 20:30:00"
}

-----------------------------------------------------------------------------------------------------------------
# Step 2 — API Gateway Setup
1.	Create a REST API.
2.	CREATE RESOURCE:
Add /posts route with:
	    POST → Create Post Lambda
	    GET → Get Posts Lambda
3.	Create Method
4.	Enable CORS for all methods.
5.	Deploy and note the Invoke URL — put it in js_app.js:
https://ehr9a6c6oc.execute-api.ap-south-1.amazonaws.com/posts/[Resource name]
# Step 3 - S3
	1.create a S3 bucket and upload all files.
# Step 4- Amplify
   1. Connect your s3 bucket with Amplify.



















