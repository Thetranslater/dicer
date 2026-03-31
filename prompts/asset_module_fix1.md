# 关于此md文件

此md文件是在浏览你生成的关于asset module代码后给出的改进方向，其中文件名fix1代表这是第一次改进对话。

# Improvement

关于上面部分的浏览资产窗口：

- 当前实现：窗口上方有breadcrumb辅助导航和展示，下方是提示信息，然后是一行行的资产和文件夹来管理和展示。

- 改进： 将提示信息和breadcrumb删除。因为我们未来将通过配置文件配置资产的根目录，之后读取配置文件即可，不在需要用户导航。资产展示区域改用grid形式的布局，不用一行行的方式，节省空间。资产文件的展示未来将用一个圆形的UI和下方名称，没有其他信息。增加一个搜索框可以搜索到对应资产的位置。

关于下面Inspector窗口：

- 当前实现：Inspector分成左右两部分，左边是component tree（其本质是一个Button list），右侧是内容展示区。

- 改进：将两部分合并成一个区域。（查看https://img-blog.csdnimg.cn/77fd769de8cb492c9e4d1d652e3db89f.png#pic_center作为Inspector样式例子，依据样式实现功能）。该区域主要是通过Tree来展示所有组件，每个Node包含两部分，左边是一个button，右侧是一个text，点击button展开查看该node对应的component属性或者关闭，右侧text是component的名称。component对应的属性UI布局交由各自具体的Component.vue来实现。