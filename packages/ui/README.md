<!-- markdownlint-disable MD030 -->

# Flowise UI

English | [中文](./README-ZH.md)

React frontend ui for Flowise.

![Flowise](https://github.com/FlowiseAI/Flowise/blob/main/images/flowise.gif?raw=true)

Install:

```bash
npm i flowise-ui
```

## useApi Hook

When calling backend endpoints, use the `useApi` hook and include the returned `request` function in effect dependency arrays. The hook keeps the API function in a ref so that requests run only once on mount:

```javascript
const { request } = useApi(fetchList)

useEffect(() => {
    request()
}, [request])
```

## License

Source code in this repository is made available under the [Apache License Version 2.0](https://github.com/FlowiseAI/Flowise/blob/master/LICENSE.md).
