# fs api

我正在重新写一份有关文件系统的IPC通信接口，查看renderer/index.d.ts下IAP.fs的接口定义。接下来我将详细产出其各个接口功能和参数定义，请你按照需求在core.ts中实现。

## open : (OpenOption?) => FSNode[]

open接口负责打开文件系统中的文件或文件夹，调用方通过配置option决定open函数的打开行为，其定义查看fileService.ts下的OpenOption.

OpenOption的fileOption和dirOption决定open对文件和文件夹的打开行为，如果fileOption.path和dirOption.path都不存在，那么open会转为打开dialog让用户决定打开对象，根据isMultiselection决定dialog是否可以多选，在获得打开路径，其打开行为依然有对应的option决定。

fileOption:

- fileOption.isLoad决定open函数是否实际加载打开文件，如果不打开则仅返回文件路径。

- fileOption.dialogfilters决定dialog中可以打开的文件类型。

dirOption:

- dirOption.isRecursive决定open是否递归的打开文件夹，如果为false则仅尝试打开本地文件夹不做递归处理，并根据fileOption.isLoad决定是否加载本地文件。（具体来说，当dirOption.isRecursive=false, fielOption.isLoad = false，其open行为与listdir等价）

返回类型为FSNode[], 当同时有fileOption.path和dirOption.path时，先push fileOption的FSNode。

## save : (content : any[], SaveOption?) => void

save接口负责向文件系统保存文件. save接口允许批量的保存多个文件，并根据SaveOption对保存行为进行配置。目前SaveOption只有一个配置选项path，允许调用方指定保存路径。否则通过dialog选择保存路径。当文件系统不存在保存路径时，需要自动创建对应文件夹路径。

## mkdir : (path : string, option?) => void

mkdir接口可以迭代的创建路径path，目前没有可配置option，留作未来使用。

## rm : (path : string, option?) => void

rm接口删除路径path，如果是文件夹则删除整个文件夹。注意，rm不允许删除任何重要的系统文件，在删除时需要进行判断。option未定义，留作未来使用。

## mv : (source : string, target : string) => void

mv接口负责将source移动到target路径。option未定义，留作未来使用。