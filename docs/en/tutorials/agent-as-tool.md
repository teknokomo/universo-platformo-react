# Agent as Tool

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific features.

In this tutorial, we are going to take a look at how to leverage other flows as tools to a parent Agent. This approach allows you to create a parent agent that can delegate specific tasks to specialized child agents

## Overview

1. Receives user input through a parent agent
2. Agent decides to retrieve data from document store, or call the Agentflow Tool.

<figure><img src="../.gitbook/assets/image (295).png" alt="" width="375"><figcaption></figcaption></figure>

### Step 1: Setting Up the Start Node

Begin by adding a **Start** node to your canvas. This serves as the entry point for your agent system.

### Step 2: Creating the Parent Agent

Add an **Agent** node and connect it to the Start node.

### Step 3: Configuring the Agent Tool

The key feature of this flow is configuring another agent as a tool. In the Parent Agent's **Tools** section:

<figure><img src="../.gitbook/assets/image (296).png" alt="" width="354"><figcaption></figcaption></figure>

#### Tool Configuration:

* **Tool**: Select "**Agent As Tool**"

#### Agent Tool Settings:

* **Selected Agentflow**: Choose your child agentflow
* **Name**: Name for the agentflow
* **Description**: Describe when this agentflow is useful. Example:

```
Useful for searching user availability, scheduling meetings and email related query
```

{% hint style="warning" %}
Name and Description for the tool are extremely important! They must be clear and correctly describe the purpose of the tool. Refer to [best practices](https://platform.openai.com/docs/guides/function-calling?api-mode=chat#best-practices-for-defining-functions) guide.
{% endhint %}

### Step 4: Adding Knowledge Sources

Configure the **Knowledge (Document Stores)** section to give your parent agent access to relevant information. This is the same as [RAG](rag.md) tutorial.

<figure><img src="../.gitbook/assets/image (297).png" alt="" width="518"><figcaption></figcaption></figure>

#### Document Store Configuration:

* **Document Store**: Select your pre-configured document store (e.g., "AI-Paper")
* **Describe Knowledge**: Describe what the knowledge is about

***

## Example Interactions

#### Sample Queries and Expected Behavior:

**Scheduling Query:**

* User: "Can you check my availability for next Tuesday?"
* Flow: Parent agent → personal\_assistant tool → specialized scheduling response

<figure><img src="../.gitbook/assets/image (301).png" alt="" width="563"><figcaption></figcaption></figure>

**Technical Query:**

* User: "What is AIGC and how does it work?"
* Flow: Parent agent → AI-Paper knowledge base → technical explanation with sources

<figure><img src="../.gitbook/assets/image (300).png" alt="" width="563"><figcaption></figcaption></figure>

**General Query:**

* User: "Hello how are you?"
* Flow: Parent agent → direct response (no tools needed)

**Complex Query:**

* User: "Schedule a meeting about AIGC implementation next Tuesday, extract key insights and the talking points"
* Flow: Parent agent → both personal\_assistant tool AND AI-Paper knowledge → coordinated response

<figure><img src="../.gitbook/assets/image (302).png" alt="" width="563"><figcaption></figcaption></figure>

***

## Best Practices

#### Design Guidelines:

1. **Clear Tool Descriptions**: Make tool name and descriptions specific and actionable
2. **Appropriate Delegation**: Better system prompt for parent agent to delegate effectively

#### Common Use Cases:

* **Customer Service**: Parent agent with specialized tools for billing, technical support, and general inquiries
* **Research Assistant**: Parent with tools for different research domains (legal, technical, market research)
* **Project Management**: Parent with tools for scheduling, resource allocation, and progress tracking
* **Content Creation**: Parent with tools for writing, editing, research, and formatting

