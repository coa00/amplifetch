import { API, graphqlOperation, Auth } from "aws-amplify";
import { pascalCase } from "change-case";
import awsconfig from "src/aws-exports";

import app from "./features/appSlice";
import * as mutations from "./graphql/mutations";
import * as queries from "./graphql/queries";
import store from "./store";

export async function addToGroup(username: string, groupname: string) {
  const apiName = "AdminQueries";
  const path = "/addUserToGroup";
  const myInit = {
    body: {
      username,
      groupname,
    },
    headers: {
      "Content-Type": "application/json",
      Authorization: `${(await Auth.currentSession())
        .getAccessToken()
        .getJwtToken()}`,
    },
  };
  return await API.post(apiName, path, myInit);
}

export async function singOut(username: string) {
  const apiName = "AdminQueries";
  const path = "/signUserOut";
  const myInit = {
    body: {
      username,
    },
    headers: {
      "Content-Type": "application/json",
      Authorization: `${(await Auth.currentSession())
        .getAccessToken()
        .getJwtToken()}`,
    },
  };
  try {
    const res = await API.post(apiName, path, myInit);
    return res;
  } catch (error) {
    store.dispatch(app.actions.setError("通信エラーが発生しました"));
    console.error(error);
    return null;
  }
}

export async function getGroup() {
  const app = store.getState().app;
  const orgGroup = {
    organizationGroup: app.organization.groupName,
    adminGroup: app.organization.adminGroupName,
  };
  return orgGroup;
}

export async function matchGroup(ckGroup: string) {
  const cuser = await Auth.currentAuthenticatedUser();
  const groups = cuser.signInUserSession.accessToken.payload["cognito:groups"];

  if (groups) {
    const match = groups.filter((group: string) => group.includes(ckGroup));
    return match.length > 0;
  } else {
    return false;
  }
}

export async function isOrgGroup() {
  const app = store.getState().app;
  const cuser = await Auth.currentAuthenticatedUser();
  const groups = cuser.signInUserSession.accessToken.payload["cognito:groups"];

  if (groups) {
    const match = groups.filter((group: string) =>
      group.includes(app.organization.groupName)
    );
    return match.length > 0;
  } else {
    return false;
  }
}

export async function isAdminGroup() {
  const app = store.getState().app;
  const cuser = await Auth.currentAuthenticatedUser();
  const groups = cuser.signInUserSession.accessToken.payload["cognito:groups"];

  if (groups) {
    const match = groups.filter((group: string) =>
      group.includes(app.organization.adminGroupName)
    );
    return match.length > 0;
  } else {
    return false;
  }
}

export async function getQuery(target: string, id: string) {
  let res;
  const queryName = `get${pascalCase(target)}`;
  try {
    //@ts-ignore
    res = await API.graphql(graphqlOperation(queries[queryName], { id }));
    //@ts-ignore
    const data = res.data[queryName];
    // console.log(`getQuery ${target} ${id}`, data);
    return data;
  } catch (error) {
    store.dispatch(app.actions.setError("通信エラーが発生しました"));
    console.error(error);
    return null;
  }
}

export async function listQuery(target: string, variable?: any) {
  let res;
  const queryName = `list${pascalCase(target)}s`;
  try {
    //@ts-ignore
    res = await API.graphql(graphqlOperation(queries[queryName], variable));
    //@ts-ignore
    const data = res.data[queryName];
    console.log(`listQuery ${target}`, data, variable);
    return data.items;
  } catch (error) {
    store.dispatch(app.actions.setError("通信エラーが発生しました"));
    console.error(error);
    return null;
  }
}

// IAM 認証用につくったけど使えない。削除
export async function listPublicQuery(target: string, variable?: any) {
  let res;
  const queryName = `list${pascalCase(target)}s`;
  try {
    //@ts-ignore
    res = await API.graphql(
      graphqlOperation({
        query: queries[queryName],
        variable,
        authMode: "AWS_IAM",
      })
    );
    console.log(`listPublicQuery target:${target}`, res);
    //@ts-ignore
    const data = res.data[queryName];
    return data.items;
  } catch (error) {
    store.dispatch(app.actions.setError("通信エラーが発生しました"));
    console.error(error);
    return null;
  }
}

export async function keyQuery(
  queryName: string,
  variable?: any,
  dataName?: string
) {
  let res;

  try {
    //@ts-ignore
    res = await API.graphql(graphqlOperation(queries[queryName], variable));
    // console.log(`${queryName}:`, res);
    //@ts-ignore
    const data = res.data[dataName ? dataName : queryName];
    console.log("user:", data);
    return data.items;
  } catch (error) {
    store.dispatch(app.actions.setError("通信エラーが発生しました"));
    console.error(error);
    return null;
  }
}

export async function searchQuery(target: string, variable?: any) {
  let res;
  if (awsconfig.aws_appsync_graphqlEndpoint.includes("192")) {
    return listQuery(target, variable);
  }
  const queryName = `search${pascalCase(target)}s`;
  try {
    //@ts-ignore
    res = await API.graphql(graphqlOperation(queries[queryName], variable));
    console.log("user:", res);
    //@ts-ignore
    const data = res.data[queryName];
    console.log("user:", data);
    return data.items;
  } catch (error) {
    store.dispatch(app.actions.setError("通信エラーが発生しました"));
    console.error(error);
    return null;
  }
}

export async function getInput(variable: any, noGroup?: boolean) {
  let input;
  if (!noGroup) {
    const groups = await getGroup();
    input = { ...variable, ...groups };
  } else {
    input = { ...variable };
  }

  if (variable.id) {
    input.updatedAt = new Date().toISOString();
  } else {
    delete input.id;
    // input.id = uuid.v4();
    input.createdAt = new Date().toISOString();
    input.updatedAt = new Date().toISOString();
  }
  return input;
}

function getQueryName(target: string, variable: any) {
  const action = variable.id ? "update" : "create";
  return `${action}${pascalCase(target)}`;
}

export async function createQuery(
  target: string,
  variable: any,
  noGroup?: boolean
) {
  const queryName = getQueryName(target, variable);
  const input = await getInput(variable, noGroup);
  try {
    const res = await API.graphql(
      //@ts-ignore
      graphqlOperation(mutations[queryName], {
        input,
      })
    );
    console.log(`create ${target}:`, res);
    //@ts-ignore
    const data = res.data[queryName];
    return data;
  } catch (error) {
    store.dispatch(app.actions.setError("通信エラーが発生しました"));
    console.error(error);
    return null;
  }
}

export async function createQueries(
  target: string,
  variables: any[],
  noGroup?: boolean
) {
  const tasks = [] as any[];

  variables.forEach(async (variable) => {
    const queryName = getQueryName(target, variable);
    const input = await getInput(variable, noGroup);
    console.log(target, queryName, input);

    const task = API.graphql(
      //@ts-ignore
      graphqlOperation(mutations[queryName], {
        input,
      })
    );

    tasks.push(task);
  });

  let resAll;
  try {
    resAll = await Promise.all(tasks);
    console.log("result:", resAll);
  } catch (error) {
    store.dispatch(app.actions.setError("通信エラーが発生しました"));
    console.error(target, error);
  }
  return resAll;
}

export async function deleteQueries(target: string, variable: any) {
  let res;
  const queryName = `delete${pascalCase(target)}`;
  try {
    res = await API.graphql(
      //@ts-ignore
      graphqlOperation(mutations[queryName], { input: variable })
    );
    console.log("user:", res);
    //@ts-ignore
    const data = res.data[queryName];
    console.log("user:", data);
    return data;
  } catch (error) {
    store.dispatch(app.actions.setError("通信エラーが発生しました"));
    console.error(error);
    return null;
  }
}
