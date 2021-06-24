var yoga = require('yoga-layout-prebuilt');

let Node = yoga.Node;

// Function Declarations w arg types and return values
// https://github.com/facebook/yoga/blob/master/javascript/sources/entry-common.js#L123

// Enums
// https://github.com/facebook/yoga/blob/master/javascript/sources/YGEnums.js

function parseNode(node, nodes, pid, cidx) {
  let id = (pid?(pid+' '):'')+node.id;

  if (!nodes) {  // first call
    let nodes = {};
    parseNode(node, nodes);
    return nodes
  }
  nodeOrder.push(id); // mw

  let n = yoga.Node.create();
  // n.id = pid?pid+node.id:node.id;
  if (pid) nodes[pid].node.insertChild(n, cidx);
  Object.keys((node.attr||{})).forEach((k, i) => { // set attrs
    let split = k.split(' ');
    let yKey = split[0].replace(/^.|-./g, d=>d[1]?d[1].toUpperCase():d[0].toUpperCase());
    let args = split.slice(1).map(d => yoga[d.toUpperCase().replace(/-/g,'_')]);
    let vals = Array.isArray(node.attr[k])?node.attr[k]:[node.attr[k]];
    let postCmd = '';

    let parser = (v, i) => {
      if (typeof(v) == 'string' && v[v.length-1] != '%' && v != 'auto' && i == 0)
        args.push( yoga[v.toUpperCase().replace(/-/g,'_')] ); // is yoga property
      else {
        if (typeof(v) == 'string' && v[v.length-1] == '%') args.push( parseFloat(v) );
        else args.push( v ); // is normal arg
      }

      if (i == vals.length-1 && typeof(v) == 'string' && v[v.length-1] == '%')  // last arg
        postCmd = 'Percent';
    }

    let run = () => {
      try {
        if (args.length)
          n[`set${yKey + postCmd}`](...args); // yoga method
      } catch(e) {
        console.error(node.id, e);
      }
    }

    vals.forEach((v, i) => {
      if (Array.isArray(v)) {
        v.forEach((d,i)=>{
          parser(d,i);
        });
        run();
        args = [];
      } else {
        parser(v,i);
      }
    });

    run()
  });

  // attrs
  // nodes[node.id] = {node:n, cfg:node};  // mw
  // (node.children||[]).forEach((item, i) => { // do children
  //   parseNode(item, nodes, node.id, i);
  // });
  nodes[id] = {node:n, cfg:node};
  (node.children||[]).forEach((item, i) => { // do children
    parseNode(item, nodes, id, i);
  });
}

let nodes;
let nodeOrder;

function resize(layout, nodes, width, height){
  nodeOrder = [];
  nodes = undefined;
  let newNodes = parseNode(layout);
  if (!nodes) nodes = newNodes;

  let pre = nodes[layout.id].cfg;
  if (!pre.attr) pre.attr = {};
  let root = nodes[layout.id].cfg.attr;
  // container responsiveness & size is set by css
  // root gets size from container
  root.width = width;
  root.height = height;

  let nKeys = Object.keys(nodes);
  newNodes[nKeys[0]].node.calculateLayout(root.width, root.height, yoga.DIRECTION_LTR);
  let resized = false;

  nKeys.forEach((item, i) => {
    let layout = newNodes[item].node.getComputedLayout();
    let parent = newNodes[item].node.getParent();
    while (parent) {
      let pLayout = parent.getComputedLayout();
      ['left', 'top'].forEach((p, i) => {
        layout[p] += pLayout[p];  // walk the parents to get abs values
      });

      parent = parent.getParent();
    }

    let newLayout = {x:layout.left, y:layout.top, w:layout.width, h:layout.height};
    let changed = (nl, ol) => Object.keys(nl).filter(d => nl[d] != (ol||{})[d]);

    if (changed(newLayout, nodes[item].layout).length) {
      if (nodes[item].cfg.triggerStateChange){
        // let onResize = new Function('return ' + nodes[item].cfg.onResize)();
        // onResize(item, newLayout, nodes[item].cfg.user); // resize updater
        self.postMessage(['nodeResized', [item, newLayout, nodes[item].cfg.user]]);
      }
      resized = true;
    }

    nodes[item].layout = newLayout;
    // nodes[item].node = newNodes[item].node;
  });

  newNodes[nKeys[0]].node.freeRecursive(); // free allocs

  // send redraw msg
  if(resized) {
    // nodeOrder.forEach(d => delete(nodes[d].node)); // don't serialize
    self.postMessage(['nodesResized', [nodes, nodeOrder]]);
  }
}

// let promisedLibs = [];

// let importLibs = (libs) => {
//   libs.forEach((l, i) => {
//     promisedLibs.push(import(l));
//   });
// }

self.addEventListener('message', function(e) {
    let calls = {
      resize:resize,
      // import:importLibs,
    };

    calls[e.data[0]](...e.data[1]);
  }, false);
