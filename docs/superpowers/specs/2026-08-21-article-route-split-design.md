# Article Route Split Design

## Goal

Separate article discovery from article review so a growing article list does not compete with the content workspace.

## Routes

- `/articles` loads filtered article summaries and every row links to `/articles/[articleId]`.
- `/articles/[articleId]` loads one `ArticleDetail` and contains the Agent draft, human final, evaluation, review and publication workflows.

## Interaction And Data

The list keeps status and platform filters, result count, score, publication count, and full title/topic text. The detail page has a return link. Version controls navigate to the selected version's dedicated URL. The list only calls `api.listArticles`; the detail view only calls `api.getArticle(articleId)` and refreshes after publication registration.

## Verification

Run lint and the production build, then use browser automation against the deployed domain to check the list, a real detail route, and the return link.
