Simulations
-----------

This is the framework to evaluate ideas in clustered environment.
With the help, you can split common engine code from detailed algorithms,
and pair different algorithms with certain engine code on the fly.

How it works
============

The framework requires you to split your code into different addons,
and each addon declares their own _requires_. It tries to solve all the
requirements and stacks addons together.

The folder structure under `addons` are defined as

_addons_/`space`/`addon_name`/`addon_name.js`

The folder `addons/space/addon_name` is privately used by this addon.

Each of _requires_ specifies the _space_, and all addons under this _space_ are the candidates.

E.g. `addons/engines/peernet/peernet.js` will be tried to match a _require_ like `engines`

Getting Started
===============

Get some help, and you should know what to do next:

```bash
node simulate --help
```