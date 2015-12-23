var Zepto = (function() {
    var undefined, key, $, classList,
        emptyArray = [],
        concat = emptyArray.concat,
        filter = emptyArray.filter,
        slice = emptyArray.slice,
        document = window.document,
        elementDisplay = {},
        classCache = {},
        // 设置CSS时，不用加px单位的属性
        cssNumber = {
            'column-count': 1,
            'columns': 1,
            'font-weight': 1,
            'line-height': 1,
            'opacity': 1,
            'z-index': 1,
            'zoom': 1
        },
        // HTML代码片断的正则
        fragmentRE = /^\s*<(\w+|!)[^>]*>/,
        singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
        // 自闭合标签 <img/>
        tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
        // 根节点
        rootNodeRE = /^(?:body|html)$/i,
        // 大写字母
        capitalRE = /([A-Z])/g,
        // 需要提供get和set的方法名
        // special attributes that should be get/set via method calls
        methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],
        // 相邻节点的一些操作
        adjacencyOperators = ['after', 'prepend', 'before', 'append'],
        table = document.createElement('table'),
        tableRow = document.createElement('tr'),
        // 这里的用途是当需要给tr,tbody,thead,tfoot,td,th设置innerHTML的时候，需要用其父元素作为容器来装载HTML字符串
        containers = {
            'tr': document.createElement('tbody'),
            'tbody': table,
            'thead': table,
            'tfoot': table,
            'td': tableRow,
            'th': tableRow,
            '*': document.createElement('div')
        },
        // 当DOM ready的时候，document会有以下三种状态的一种
        readyRE = /complete|loaded|interactive/,
        simpleSelectorRE = /^[\w-]*$/,
        class2type = {},
        toString = class2type.toString,
        zepto = {},
        camelize, uniq,
        tempParent = document.createElement('div'),
        propMap = {
            'tabindex': 'tabIndex',
            'readonly': 'readOnly',
            'for': 'htmlFor',
            'class': 'className',
            'maxlength': 'maxLength',
            'cellspacing': 'cellSpacing',
            'cellpadding': 'cellPadding',
            'rowspan': 'rowSpan',
            'colspan': 'colSpan',
            'usemap': 'useMap',
            'frameborder': 'frameBorder',
            'contenteditable': 'contentEditable'
        },
        isArray = Array.isArray || function(object) {
            return object instanceof Array;
        };

    //用于检查某个元素element是否 匹配 选择器表达式selector。
    zepto.matches = function(element, selector) {
        // 判断element是否是DOM对象
        if (!selector || !element || element.nodeType !== 1) return false;
        var matcheSelector = element.webkitMatchesSelector || element.mozMatchesSelector || element.oMatchesSelector || element.matchesSelector;
        if (matchesSelector) return matchesSelector.call(element, selector);
        // fall back to preforming a selector:
        var match,
            parent = element.parentNode,
            temp = !parent;
        // 判断是否有父元素, 没有则temp = true
        if (temp)(parent = tempParent).appendChild(element);
        match = ~zepto.qsa(parent, selector).indexOf(element);
        temp && tempParent.removeChild(element);
        return match;
    };
    // 获取对象类型
    function type(obj) {
        // obj为null或者undefined时，直接返回'null'或'undefined'
        return obj == null ? String(obj) : class2type[toString.call(obj)] || 'object';
    }

    function isFunction(value) {
        return type(value) == 'function'
    }

    function isWindow(obj) {
        return obj != null && obj == obj.window
    }

    function isDocument(obj) {
        return obj != null && obj.nodeType == obj.DOCUMENT_NODE
    }
    // 判断是否是对象
    function isObject(obj) {
        return type(obj) == 'object'
    }
    // 对于通过字面量定义的对象和new Object的对象返回true，new Object时传参数的返回false
    // 可参考http://snandy.iteye.com/blog/663245
    function isPlainObject(obj) {
        return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype;
    }
    // 类数组，比如nodeList，这个只是做最简单的判断，如果给一个对象定义一个值为数据的length属性，它同样会返回true
    function likeArray(obj) {
        return typeof obj.length == 'number';
    }
    // 剔除空数组项 null/undefined
    function compact(array) {
        return filter.call(array, function(item) {
            return item != null
        });
    }
    // 类似得到一个数组的副本
    function flatten(array) {
        return array.length > 0 ? $.fn.concat.apply([], array) : array;
    }
    // 变量驼峰化
    camelize = function(str) {
        return str.replace(/-+(.)?/g, function(match, chr) {
            return chr ? chr.toUpperCase() : '';
        });
    };
    // borderWidth -> border-width
    function dasherize(str) {
        return str.replace(/::/g, '/') //将::替换成/
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') // 在大小写字符之间插入_,大写在前，比如AAAbb,得到AA_Abb
            .replace(/([a-z\d])([A-Z])/g, '$1_$2') //在大小写字符之间插入_,小写或数字在前，比如bbbAaa,得到bbb_Aaa
            .replace(/_/g, '-') //将_替换成-
            .toLowerCase(); //转成小写
    }
    // 数组去重
    uniq = function(array) {
        return filter.call(array, function(item, idx) {
            return array.indexOf(item) == idx;
        });
    };
    // 将给定的参数生成正则
    function classRE(name) {
        // classCache, 缓存正则
        return name in classCache ? classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'));
    }
    // 给需要加px的CSS属性 添加px
    function maybeAddPx(name, value) {
        return (typeof value == 'number' && !cssNumber[dasherize(name)]) ? value + 'px' : value;
    }
    // 获取节点默认的 display 属性
    function defaultDisplay(nodeName) {
        var element, display;
        // 缓存中不存在
        if (!elementDisplay[nodeName]) {
            element = document.createElement(nodeName);
            document.body.appendChild(element);
            // [getComputedStyle](http://www.zhangxinxu.com/wordpress/2012/05/getcomputedstyle-js-getpropertyvalue-currentstyle/)
            display = getComputedStyle(element, '').getPropertyValue('display');
            element.parentNode.removeChild(element);
            display == 'none' && (display = 'block');
            // 缓存元素的默认 display 属性
            elementDisplay[nodeName] = display;
        }
        return elementDisplay[nodeName];
    }
    // 获取元素的子元素,Firefox不支持 children ,所以只能通过筛选 childNodes
    function chidren(element) {
        // [].slice.call(arrayLike) 将 类数组对象 转化为 数组
        return 'children' in element ? slice.call(element.children) : $map(element.childNodes, function(node) {
            if (node.nodeType == 1) return node;
        });
    }
    //
    function Z(dom, selector) {
        var i, len = dom ? dom.length : 0;
        for (i = 0, i < len; i++) this[i] = dom[i];
        this.length = len;
        this.selector = selector || '';
    }
    // `$.zepto.fragment` takes a html string and an optional tag name
    // to generate DOM nodes from the given html string.
    // The generated DOM nodes are returned as an array.
    // This function can be overriden in plugins for example to make
    // it compatible with browsers that don't support the DOM fully.
    zepto.fragment = function(html, name, properties) {
        var dom, nodes, container;

        // A special case optimization for a single tag
        if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1));

        if (!dom) {
            // 将类似<div class="test"/>替换成<div class="test"></div>,算是一种修复吧
            if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>");
            // 如果name为空, 正则判断html字符串, 并给name取标签名
            if (name === undefined) name = fragmentRE.test(html) && RegExp.$1;
            // 设置容器标签名，如果不是tr,tbody,thead,tfoot,td,th，则容器标签名为div
            if (!(name in containers)) name = '*';

            container = containers[name]; // 创建容器
            container.innerHTML = '' + html; // 将html代码片断放入容器
            // 删除容器的子节点，这样就直接把字符串转成DOM节点了
            dom = $.each(slice.call(container.childNodes), function() {
                container.removeChild(this);
            });
        }
        // 如果properties是对象, 则将其当作属性来给添加进来的节点进行设置
        if (isPlainObject(properties)) {
            nodes = $(dom); // 将dom转成zepto对象，为了方便下面调用zepto上的方法
            // 遍历对象，设置属性
            $.each(properties, function(key, value) {
                // 如果设置的是'val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'，则调用zepto上相对应的方法
                if (methodAttributes.indexOf(key) > -1) nodes[key](value);
                else nodes.attr(key, value);
            });
        }
        // 返回将字符串转成的DOM节点后的数组，比如'<li></li><li></li><li></li>'转成[li,li,li]
        return dom;
    };

    // `$.zepto.Z` swaps out the prototype of the given `dom` array
    // of nodes with `$.fn` and thus supplying all the Zepto functions
    // to the array. This method can be overriden in plugins.
    zepto.Z = function(dom, selector) {
        // zepto对象
        return new Z(dom, selector);
    };
    // `$.zepto.isZ` should return `true` if the given object is a Zepto
    // collection. This method can be overriden in plugins.
    zepto.isZ = function(object) {
        return object instanceof zepto.Z;
    };

    zepto.init = function(selector, context) {
        var dom;
        if (!selector) return zepto.Z();
        else if (typeof selector == 'string') {
            selector = selector.trim();
            if (selector[0] == '<' && fragmentRE.test(selector))
                dom = zepto.fragment(selector, RegExp.$1, context), selector = null;
            else if (context !== undefined) return $(context).find(selector);
            else dom = zepto.qsa(document, selector);
        } else if (isFunction(selector)) return $(document).ready(selector);
        else if (zepto.isZ(selector)) return selector;
        else {
            if (isArray(selector)) dom = compact(selector);
            else if (isObject(selector))
                dom = [selector], selector = null;
            else if (fragmentRE.test(selector))
                dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null;
            else if (context !== undefined) return $(context).find(selector);
            else dom = zepto.qsa(document, selector);
        }
        return zepto.Z(dom, selector);
    };

    $ = function(selector, context) {
        return zepto.init(selector, context);
    };

    function extend(target, source, deep) {
        for (key in source)
            // 深拷贝 && (扩展的数据是对象 || 数组)
            if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
                // 扩展的数据是对象 && target[key]不是对象
                if (isPlainObject(source[key]) && !isPlainObject(target[key]))
                    target[key] = {};
                // 扩展的数据是数组 && target[key]不是数组
                if (isArray(source[key]) && !isArray(target[key]))
                    target[key] = [];
                // 递归深拷贝
                extend(target[key], source[key], deep);
            } else if (source[key] !== undefined) target[key] = source[key];    // 浅拷贝
    }
    // Copy all but undefined properties from one or more
    // objects to the `target` object.
    $.extend = function(target) {
        var deep, args = slice.call(arguments, 1);
        // 如果第一个参数为ture，则进行深拷贝
        if (typeof target == 'boolean') {
            deep = target;
            // target = arguments[1]
            target = args.shift(); // 将数组首端去掉，并赋值给target
        }
        args.forEach(function(arg) {
            extend(target, arg, deep);
        });
        return target;
    };
});
