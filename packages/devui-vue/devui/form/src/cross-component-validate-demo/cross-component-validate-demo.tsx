import { defineComponent, ref, watch } from 'vue';
import './cross-component-validate-demo.scss';

export default defineComponent({
  name: 'CrossComponentValidateDemo',
  props: {
    age: {
      type: [Number, String],
      default: 0
    }
  },
  emits: ['ageChange'],
  setup(props, ctx) {
    const ageData = ref(props.age);

    const customAsyncValidator = (rule, value) => {
      return value >= 0 && value <= 200;
    }

    watch(() => props.age, (newVal) => {
      ageData.value = newVal;
    })
    
    return () => {
      return <div class="cross-component-validate-demo" id="cross-component-validate-demo">
        <d-input v-model={ageData.value} onChange={(val) => {
          ctx.emit('ageChange', val);
        }} v-d-validate-rules={{
          rules: {
            asyncValidators: [
              {message: '年龄范围必须在0~200之间', asyncValidator: customAsyncValidator}
            ]
          },
          options: {
            updateOn: 'input',
            asyncDebounceTime: 500
          }
        }} />
      </div>
    }
  }
})