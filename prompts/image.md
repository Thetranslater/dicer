# Image

## 功能

在编辑器中实现插入图片的功能。

## 实现

我们需要借用extension-image（https://tiptap.dev/docs/editor/extensions/nodes/image）和我们写的Openfile逻辑来实现。

1. 渲染进程发送打开图像给主进程，通过ipcrenderer.invoke实现。
2. 主进程选择打开的图像，将路径通过我们编写的menu-file-open通道返回给渲染进程，渲染进程按照fileservice.ts文件中的构造，构造一个callback来执行返回图像的加载，注册到统一的AfterReadListeners（即将src标签设置为文件路径，具体实现可仿照editor.vue中获得json或html文件的方法）
3. 在details填充上，source标签指的的请求来源，这里填写editor来说明请求来源为editor，并在callback中实现检查details来确定filepath是图像，而不是其他东西（因为根据架构，任何文件加载都会执行一次callbacks的emit）。