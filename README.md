# Codeforces Un-definer


#### This is my first Chrome extension, and I made it to solve a small annoyance I often have while reading C++ submissions: too many macros, especially short aliases for loops and common operations.

Chrome Web Store: [install Codeforces Un-definer](https://chromewebstore.google.com/detail/codeforces-un-definer/fajcabgdmebhmenoadkhjmhpmfnnknol)

GitHub: [source code](https://github.com/hggfhggf/Un-definer/)

**Codeforces Un-definer** adds small intuitive interface buttons near `#define` and simple `typedef` lines. When you click one, the declaration is crossed out and its usages are rewritten inline in the code. This way, you can easily turn macros and typedefs on and off while reading.

For example, here is a comparison image:

![Codeforces Un-definer example](https://i.ibb.co.com/8gtsVWS9/example.png)



The current expansion logic is lightweight. It works well for many common competitive programming macros, but it is not perfect and does not try to fully emulate the C++ preprocessor. In some cases, it may produce confusing text.

If you find a common case where it fails, or if you have any suggestions, feel free to report it on GitHub Issues or write it in the comments:

[GitHub Issues](https://github.com/hggfhggf/Un-definer/issues)

I plan to update it if I receive useful feedback or suggestions.

Chrome Web Store: [install Codeforces Un-definer](https://chromewebstore.google.com/detail/codeforces-un-definer/fajcabgdmebhmenoadkhjmhpmfnnknol)

TODO list:

multi-row defines

supporting other cp sites

FireFox extension
