import AsyncValidator, { RuleItem } from 'async-validator';
import { VNode, DirectiveBinding } from 'vue';
import { debounce } from 'lodash-es';
import { EventBus, isObject, hasKey } from '../util';
import './style.scss';

interface ValidateFnParam {
  validator: AsyncValidator
  modelValue: Record<string, unknown>
  el: HTMLElement
  tipEl: HTMLElement
  isFormTag: boolean
  message: string
  messageShowType: MessageShowType
  dfcUID: string
  popPosition: PopPosition | Array<BasePopPosition>
}

interface CustomValidatorRuleObject {
  message: string
  validator: (rule, value) => boolean
  asyncValidator: (rule, value) => Promise<boolean>
}

interface DirectiveValidateRuleOptions {
  updateOn?: UpdateOn
  errorStrategy?: ErrorStrategy
  asyncDebounceTime?: number
  popPosition?: PopPosition | Array<BasePopPosition>
}

interface DirectiveBindingValue {
  rules: Partial<DirectiveCustomRuleItem>[]
  options: DirectiveValidateRuleOptions
  messageShowType: MessageShowType
  errorStrategy: ErrorStrategy
}

interface DirectiveCustomRuleItem extends RuleItem {
  validators: CustomValidatorRuleObject[]
  asyncValidators: CustomValidatorRuleObject[]
}

export interface ShowPopoverErrorMessageEventData {
  showPopover?: boolean 
  message?: string
  uid?: string, 
  popPosition?: PopPosition
}

type MessageShowType = 'popover' | 'text' | 'none' | 'toast';
type UpdateOn = 'input' | 'focus' | 'change' | 'blur' | 'submit';
type ErrorStrategy = 'dirty' | 'pristine';
type BasePopPosition = 'left' | 'right' | 'top' | 'bottom';
type PopPosition = BasePopPosition | 'left-top' | 'left-bottom' | 'top-left' | 'top-right' | 'right-top' | 'right-bottom' | 'bottom-left' | 'bottom-right';

enum ErrorStrategyEnum {
  dirty = 'dirty',
  pristine = 'pristine'
}

enum UpdateOnEnum {
  input = 'input',
  focus = 'focus',
  change = 'change',
  blur = 'blur',
  submit = 'submit',
}

enum MessageShowTypeEnum {
  popover = 'popover',
  text = 'text',
  none = 'none',
  toast = 'toast'
}

// 获取async-validator可用的规则名
function getAvaliableRuleObj(ruleName: string, value: any) {
  if(!ruleName) {
    console.error("[v-d-validate] validator's key is invalid");
    return null;
  }
  switch(ruleName) {
    case 'maxlength':
      return {
        type: 'string',
        max: value,
        asyncValidator: (rule, val) => {
          return new Promise((resolve, reject) => {
            if(val.length > value) {
              reject('最大长度为' + value);
            }else {
              resolve('校验通过');
            }
          })
        }
      };
    case 'minlength':
      return {
        type: 'string',
        min: value,
        asyncValidator: (rule, val) => {
          return new Promise((resolve, reject) => {
            if(val.length < value) {
              reject('最小长度为' + value);
            }else {
              resolve('校验通过');
            }
          })
        }
      };
    case 'min':
      return {
        type: 'number',
        asyncValidator: (rule, val) => {
          return new Promise((resolve, reject) => {
            if(val < value) {
              reject('最小值为' + value);
            }else {
              resolve('校验通过');
            }
          })
        }
      };
    case 'max':
      return {
        type: 'number',
        asyncValidator: (rule, val) => {
          return new Promise((resolve, reject) => {
            if(val > value) {
              reject('最大值为' + value);
            }else {
              resolve('校验通过');
            }
          })
        }
      };
    case 'required':
      return {
        reqiured: true,
        asyncValidator: (rule, val) => {
          return new Promise((resolve, reject) => {
            if(!val) {
              reject('必填项');
            }else {
              resolve('校验通过');
            }
          })
        }
      };
    case 'requiredTrue':
      return {
        asyncValidator: (rule, val) => {
          return new Promise((resolve, reject) => {
            if(!val) {
              reject('必须为true值');
            }else {
              resolve('校验通过');
            }
          })
        }
      };
    case 'email':
      return {
        type: 'email',
        message: '邮箱格式不正确'
      };
    case 'pattern':
      return {
        type: 'regexp',
        pattern: value,
        message: '只能包含数字与大小写字符',
        validator: (rule, val) => value.test(val),
      };
    case 'whitespace':
      return {
        message: '输入不能全部为空格或空字符',
        validator: (rule, val) => !!val.trim()
      };
    default: 
      return {
        [ruleName]: value,
      };
  }
}

function getKeyValueOfObjectList(obj): {key: string; value: any;}[] {
  const kvArr = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      kvArr.push({
        key,
        value: obj[key]
      })
    }
  }
  return kvArr;
}

function handleErrorStrategy(el: HTMLElement): void {
  const classList: Array<string> =  [...el.classList];
  classList.push('d-validate-rules-error-pristine');
  el.setAttribute('class', classList.join(' '));
}

function handleErrorStrategyPass(el: HTMLElement): void {
  const classList: Array<string> =  [...el.classList];
  const index = classList.indexOf('d-validate-rules-error-pristine');
  index !== -1 && classList.splice(index, 1);
  el.setAttribute('class', classList.join(' '));
}

function handleValidateError({el, tipEl, message, isFormTag, messageShowType, dfcUID, popPosition = 'right-bottom'}: Partial<ValidateFnParam>): void {
  // 如果该指令用在form标签上，这里做特殊处理
  if(isFormTag && messageShowType === MessageShowTypeEnum.toast) {
    // todo：待替换为toast
    alert(message);
    return;
  }

  // messageShowType为popover时，设置popover
  if(MessageShowTypeEnum.popover === messageShowType) {
    EventBus.emit("showPopoverErrorMessage", {showPopover: true, message, uid: dfcUID, popPosition} as ShowPopoverErrorMessageEventData);
    return;
  }

  tipEl.innerText = '' + message;
  tipEl.style.display = 'inline-flex';
  tipEl.setAttribute('class', 'd-validate-tip');
  handleErrorStrategy(el);
}

function handleValidatePass(el: HTMLElement, tipEl: HTMLElement): void {
  tipEl.style.display = 'none';
  handleErrorStrategyPass(el);
}

// 获取ref的name
function getRefName(binding: DirectiveBinding): string {
  const _refs = binding.instance.$refs;
  const refName = Object.keys(_refs)[0];
  return refName;
}

// 获取表单name
function getFormName(binding: DirectiveBinding): string {
  const _refs = binding.instance.$refs;
  const key = Object.keys(_refs)[0];
  return _refs[key] ? _refs[key]['name'] : '';
}

// 校验处理函数
function validateFn({validator, modelValue, el, tipEl, isFormTag, messageShowType, dfcUID, popPosition}: Partial<ValidateFnParam>) {
  validator.validate({modelName: modelValue}).then(() => {
    handleValidatePass(el, tipEl);
  }).catch((err) => {
    const { errors } = err;
    if(!errors || errors.length === 0) return;
    let msg = '';

    // todo: 待支持国际化
    if(typeof errors[0].message === 'object') {
      msg = errors[0].message.default;
    }else {
      msg = errors[0].message;
    }

    handleValidateError({el, tipEl, message: msg, isFormTag, messageShowType, dfcUID, popPosition});
  })
}

// 检测popover的position是否是正确值
function checkValidPopsition(positionStr: string): boolean {
  const validPosition = ['left', 'right', 'top', 'bottom', 'left-top', 'left-bottom', 'top-left', 'top-right', 'right-top', 'right-bottom', 'bottom-left', 'bottom-right'];
  const isValid = validPosition.includes(positionStr);
  !isValid && console.warn(`invalid popPosition value '${positionStr}'.`);
  return isValid
}

// 获取FormControl标签上的uid
function getDfcUID(el: HTMLElement) {
  if(el.tagName === "BODY") return "";
  if(el.dataset['uid']) return el.dataset['uid'];
  let parent = el.parentElement;
  if(parent.dataset['uid']?.startsWith('dfc-')) {
    return parent.dataset['uid'];
  } else {
    return getDfcUID(parent.parentElement);
  }
}


export default {
  mounted(el: HTMLElement, binding: DirectiveBinding, vnode: VNode): void {
    const isFormTag = el.tagName === 'FORM';
    let dfcUID = getDfcUID(el);
    const refName = getRefName(binding);

    const hasOptions = isObject(binding.value) && hasKey(binding.value, 'options');

    // 获取指令绑定的值
    let { 
      rules: bindingRules, 
      options = {}, 
      messageShowType = MessageShowTypeEnum.popover
    }: DirectiveBindingValue = binding.value;
    let { errorStrategy }: DirectiveBindingValue = binding.value;

    if(refName) {
      // 判断d-form是否传递了messageShowType属性
      messageShowType = binding.instance[refName]["messageShowType"] ?? "popover";
    }

    // errorStrategy可配置在options对象中
    let { 
      updateOn = UpdateOnEnum.change, 
      errorStrategy: ErrorStrategy = ErrorStrategyEnum.dirty, 
      asyncDebounceTime = 300,
      popPosition = ['right', 'bottom']
    }: DirectiveValidateRuleOptions = options;

    // 设置popover的位置
    if(messageShowType === MessageShowTypeEnum.popover) {
      if(Array.isArray(popPosition)) {
        popPosition = (popPosition.length > 1 ? popPosition.join('-') : popPosition[0]) as PopPosition;
        if(!checkValidPopsition(popPosition)) {
          popPosition = 'right-bottom';
        }
      }else if(!checkValidPopsition(popPosition)) {
        popPosition = 'right-bottom';
      }
    }

    if(!errorStrategy) {
      errorStrategy = ErrorStrategy;
    }

    // 判断是否有options，有就取binding.value对象中的rules对象，再判断有没有rules对象，没有就取binding.value
    let customRule: Partial<DirectiveCustomRuleItem> | DirectiveBindingValue = {};
    if(hasOptions) {
      customRule = bindingRules ?? binding.value
    }else {
      customRule = binding.value as DirectiveBindingValue
    }

    const isCustomValidator = customRule && isObject(customRule) && (hasKey(customRule, 'validators') || hasKey(customRule, 'asyncValidators'));
    
    const rules = Array.isArray(customRule) ? customRule : [customRule];
    const tipEl = document.createElement('span');

    // messageShowType控制是否显示文字提示
    if(messageShowType !== MessageShowTypeEnum.none) {
      el.parentNode.append(tipEl);
    }

    const descriptor = {
      modelName: []
    };

    rules.forEach((rule) => {
      const kvObjList = !Array.isArray(rule) && getKeyValueOfObjectList(rule);
      let ruleObj: Partial<CustomValidatorRuleObject> = {};
      let avaliableRuleObj = {};
      kvObjList.forEach(item => {
        avaliableRuleObj = getAvaliableRuleObj(item.key, item.value);
        ruleObj = {...ruleObj, ...avaliableRuleObj};
      });
      descriptor.modelName.push(ruleObj);
    });

    // 使用自定义的验证器
    if(isCustomValidator) {
      // descriptor.modelName = [];
      const {validators, asyncValidators} = customRule as DirectiveCustomRuleItem;

      // 校验器
      validators && validators.forEach(item => {
        const ruleObj: Partial<CustomValidatorRuleObject> = {
          message: item?.message || '',
          validator: (rule, value) => item.validator(rule, value),
        }
        descriptor.modelName.push(ruleObj);
      });

      // 异步校验器
      asyncValidators && asyncValidators.forEach(item => {
        const ruleObj: Partial<CustomValidatorRuleObject> = {
          message: item?.message || '',
          asyncValidator: (rule, value) => {
            return new Promise(debounce((resolve, reject) => {
              const res = item.asyncValidator(rule, value);
              if(res) {
                resolve('');
              }else {
                reject(rule.message);
              }
            }, asyncDebounceTime))
          }, 
        }
        descriptor.modelName.push(ruleObj);
      });
    }

    // 校验器对象
    const validator = new AsyncValidator(descriptor);

    const htmlEventValidateHandler = (e) => {
      // 监听事件的回调函数中需重新获取dfcUID
      // 当d-validate-rules指令用在跨组件验证时，因子组件先mounted，这时父组件还未mounted，拿不到父组件的data-uid，所以这里需重新获取dfcUID
      dfcUID = getDfcUID(el);
      const modelValue = e.target.value;
      if(messageShowType === MessageShowTypeEnum.popover) {
        EventBus.emit("showPopoverErrorMessage", {showPopover: false, message: "", uid: dfcUID, popPosition} as ShowPopoverErrorMessageEventData);
      }
      validateFn({validator, modelValue, el, tipEl, isFormTag: false, messageShowType, dfcUID, popPosition});
    }

    // 监听事件验证
    vnode.children[0].el.addEventListener(updateOn, htmlEventValidateHandler); 

    // 设置errorStrategy
    if(errorStrategy === ErrorStrategyEnum.pristine) {
      handleErrorStrategy(el);
      // pristine为初始化验证，初始化时需改变下原始值才能出发验证
      vnode.children[0].props.value = '' + vnode.children[0].props.value;
    }

    const formName = getFormName(binding);
    // 处理表单提交验证
    formName && EventBus.on(`formSubmit:${formName}`, () => {
      const modelValue = isFormTag ? '' : vnode.children[0].el.value;
      
      // 进行提交验证
      validateFn({validator, modelValue, el, tipEl, isFormTag, messageShowType});
    });
    
  }
}
