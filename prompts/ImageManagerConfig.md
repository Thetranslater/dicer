# 图像管理设置页面

这部分是对菜单的设置页面中的图像管理页面相关的设置选项。

## 可设置内容

当前设置页面包含两项项核心功能：

1. 设置图像管路模块的root路径，通过dialog进行选择一个文件夹，使用FileService.OpenFileSignal，通过配置options参数来仅返回文件夹路径。

2. 给图像管理模块下的所有管理图像配置NGA的附件路径，具体来说就是{image path}->{nga attachment url}，将每一张本地图像通过设置映射到对应的附件url下。
在ImagesManagerSettings.vue中应该展示所有的管理图像对应的路径，紧跟在后面的是一个input element，用户通过input输入对应路径的对应附件url。其展示的image path采用相对路径（相对于上面设置的root路径），举例来说，如果root设置为D:/projects/project_name/images, 而图像绝对路径是D:/projects/project_name/images/ch_1/smile.png， 那么展示的image path就是ch1/smile.png。