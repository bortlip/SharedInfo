# Using GitHub with ChatGPT: A Beginner's Guide

This guide shows you how to create a GitHub account and repository, connect GitHub to ChatGPT, and ask ChatGPT to create and edit files.

You do not need to know programming, Git, or source control. You also do not need to install anything.

## 1. The basic ideas

**GitHub** is a website for storing projects and keeping a history of their files.

A project on GitHub is called a **repository**, usually shortened to **repo**. It is similar to an online folder, except GitHub remembers the changes made to it.

A saved change is called a **commit**. Git is the underlying system GitHub uses to track those changes.

You do not need to learn Git commands for this tutorial.

Learn more:

- [About GitHub and Git](https://docs.github.com/en/get-started/start-your-journey/about-github-and-git)
- [About repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories)
- [About Git](https://docs.github.com/en/get-started/using-git/about-git)

## 2. Create a GitHub account

1. Go to [github.com](https://github.com/).
2. Select **Sign up**.
3. Sign up with an email address, or choose **Continue with Google** or **Continue with Apple**.
4. Choose a username.
5. Follow the instructions to verify your email address.

Choose a username you are comfortable showing other people. It may appear on your GitHub profile and in repository addresses.

GitHub also supports two-factor authentication, which adds an extra login check. Enabling it is recommended. Save any recovery codes somewhere safe.

More help: [Creating a GitHub account](https://docs.github.com/en/get-started/start-your-journey/creating-an-account-on-github)

## 3. Create your first repository

After signing into GitHub:

1. Select the **+** button near the upper-right corner.
2. Select **New repository**.
3. Enter a name, such as `my-chatgpt-files`.
4. Add an optional description, such as `Files and notes that I manage with ChatGPT.`
5. Select **Private**.
6. Turn on **Add a README file**.
7. Select **Create repository**.

The README is the introductory page for the repository. Leave the default text in place for now; updating it will be ChatGPT's first task.

Do not store passwords, recovery codes, API keys, banking information, or other secrets in the repository.

More help: [Creating a new repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)

## 4. Connect GitHub to ChatGPT

In ChatGPT:

1. Open **Plugins**.
2. Scroll down and select **Browse plugins**.
3. Find the **GitHub** plugin.
4. Select it and choose **Connect**.

ChatGPT will send you to GitHub to install or authorize the **ChatGPT Codex Connector**.

When GitHub asks which repositories it may access:

1. Choose **Only select repositories**.
2. Select `my-chatgpt-files`.
3. Review the requested permissions.
4. Select **Install** or the equivalent confirmation button.

Return to ChatGPT when the connection is complete. A newly connected repository may take a few minutes to appear.

More help:

- [Plugins in ChatGPT and Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex)
- [ChatGPT Codex Connector on GitHub](https://github.com/apps/chatgpt-codex-connector)

## 5. Give ChatGPT its first task

Start a normal ChatGPT conversation and enter:

```text
Use GitHub to update README.md in my repository named my-chatgpt-files.

Replace the default README with a short, beginner-friendly explanation that this repository contains files and notes that I manage with ChatGPT.
```

ChatGPT may ask you to approve the action. Review the request and approve it when it matches what you asked for.

## 6. Check the result

Return to GitHub and open the `my-chatgpt-files` repository.

Open `README.md`. You should see the text created by ChatGPT.

GitHub also keeps a record of the change, so you can inspect what changed and see earlier versions later.

## 7. Ask ChatGPT to create a file

Return to ChatGPT and enter:

```text
Create a file named ideas.md in my repository named my-chatgpt-files.

Add the heading "Ideas" and a short list of useful things I could store in this repository.
```

Return to GitHub and confirm that `ideas.md` appears.

You have now used ChatGPT to edit an existing file and create a new one.

## 8. How to ask for future changes

A useful request normally needs only:

- The repository name
- What you want created or changed
- Any important requirements for the result

For example:

```text
Update ideas.md in my repository named my-chatgpt-files.

Organize the ideas into Personal, Home, and Work sections.
```

Concentrate on describing the result you want.

## 9. What a pull request is

A **pull request**, usually shortened to **PR**, lets you review proposed changes before adding them to the main version of a repository.

PRs are useful for larger or important changes because GitHub clearly shows what will change. To ask for one, add:

```text
Make the changes on a new branch and open a pull request for me to review.
```

### Review and merge a PR

1. Open the pull request link in GitHub.
2. Read the summary on the **Conversation** tab.
3. Open **Files changed**.
4. Review the changes. Green lines were added; red lines were removed.
5. Ask ChatGPT to correct anything that is wrong.
6. When the result looks right, select **Merge pull request**, then **Confirm merge**.

**Merging** means accepting the proposed changes and adding them to the repository's main version. GitHub may then offer to delete the temporary branch used for the PR.

More help:

- [About pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests)
- [Reviewing proposed changes](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request)
- [Merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request)

## 10. Give ChatGPT access to another repository

The ChatGPT Codex Connector can use only repositories you authorize.

After creating another repository:

1. Open GitHub **Settings**.
2. Open **Applications**.
3. Find **ChatGPT Codex Connector** under installed GitHub apps.
4. Select **Configure**.
5. Add the new repository under **Repository access**.
6. Save the change.

You normally do not need to reinstall the connector. You only need to add the new repository to its allowed list.

## Basic safety

- Do not store passwords, recovery codes, API keys, or financial information in GitHub.
- Give the connector access only to repositories it needs.
- Review important changes after ChatGPT makes them.
- Use a pull request when you want a separate review step.
- Remove repository access when it is no longer needed.

## The complete workflow

1. Create a repository on GitHub.
2. Give the ChatGPT Codex Connector access to it.
3. Ask ChatGPT in a normal conversation to create or edit something.
4. Review the result on GitHub.
5. Use a pull request when a change deserves an extra review step.
