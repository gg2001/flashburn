import {
  useEffect,
  useReducer,
  useRef,
  useCallback,
  createContext,
  useContext,
  Context,
  ReactNode,
} from "react";
import { BigNumber, ethers } from "ethers";
import useWeb3React from "./useWeb3React";
import {
  getSynthetixAddresses,
  getSynthetixBalances,
  SynthetixAddresses,
  SynthetixBalances,
} from "../utils";

export type State = {
  loaded: boolean;
  error: boolean;
  synthetixAddresses: { loaded: boolean } & SynthetixAddresses;
  balances: SynthetixBalances;
};

enum ActionType {
  FETCHED_ADDRESSES_PROVIDER,
  FETCHED_BALANCES_PROVIDER,
  SET_ERROR,
}

type Action =
  | {
      type: ActionType.FETCHED_ADDRESSES_PROVIDER;
      payload: { synthetixAddresses: SynthetixAddresses };
    }
  | {
      type: ActionType.FETCHED_BALANCES_PROVIDER;
      payload: Omit<State, "loaded" | "error" | "synthetixAddresses">;
    }
  | {
      type: ActionType.SET_ERROR;
    };

const initialState: State = {
  loaded: false,
  error: false,
  synthetixAddresses: {
    loaded: false,
    synthetix: ethers.constants.AddressZero,
    snx: ethers.constants.AddressZero,
    delegateApprovals: ethers.constants.AddressZero,
    sUSD: ethers.constants.AddressZero,
    systemSettings: ethers.constants.AddressZero,
    exchangeRates: ethers.constants.AddressZero,
  },
  balances: {
    balanceOf: BigNumber.from("0"),
    collateralisationRatio: BigNumber.from("0"),
    transferableSynthetix: BigNumber.from("0"),
    debtBalanceOf: BigNumber.from("0"),
    collateral: BigNumber.from("0"),
    issuanceRatio: BigNumber.from("0"),
    targetThreshold: BigNumber.from("0"),
    rateForCurrency: BigNumber.from("0"),
  },
};

const SynthetixContext: Context<State> = createContext<State>(initialState);

function useSynthetix(): State {
  return useContext(SynthetixContext);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case ActionType.FETCHED_ADDRESSES_PROVIDER: {
      const { synthetixAddresses } = action.payload;
      return {
        ...state,
        synthetixAddresses: { ...synthetixAddresses, loaded: true },
      };
    }
    case ActionType.FETCHED_BALANCES_PROVIDER: {
      const { balances } = action.payload;
      return {
        ...state,
        loaded: true,
        error: false,
        balances,
      };
    }
    case ActionType.SET_ERROR: {
      if (state.loaded) {
        return { ...state };
      } else {
        return {
          ...state,
          error: true,
        };
      }
    }
    default:
      throw new Error();
  }
}

export function SynthetixProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const mounted = useRef<boolean>(false);
  const { provider, chainId, address } = useWeb3React();
  const [state, dispatch] = useReducer<(state: State, action: Action) => State>(
    reducer,
    initialState
  );
  const { synthetixAddresses } = state;

  useEffect(() => {
    mounted.current = true;
    const fetchData = async () => {
      if (provider !== undefined) {
        try {
          const synthetixAddresses: SynthetixAddresses =
            await getSynthetixAddresses(provider, chainId);
          if (mounted.current)
            dispatch({
              type: ActionType.FETCHED_ADDRESSES_PROVIDER,
              payload: { synthetixAddresses },
            });
        } catch (error) {
          console.log(error.message);
          if (mounted.current)
            dispatch({
              type: ActionType.SET_ERROR,
            });
        }
      }
    };
    fetchData();
    return () => {
      mounted.current = false;
    };
  }, [provider, chainId]);

  const fetchBalances = useCallback(async () => {
    if (
      synthetixAddresses.loaded &&
      provider !== undefined &&
      address !== ethers.constants.AddressZero
    ) {
      try {
        const synthetixBalances: SynthetixBalances = await getSynthetixBalances(
          provider,
          chainId,
          address,
          synthetixAddresses
        );
        if (mounted.current)
          dispatch({
            type: ActionType.FETCHED_BALANCES_PROVIDER,
            payload: { balances: synthetixBalances },
          });
      } catch (error) {
        console.log(error.message);
        if (mounted.current)
          dispatch({
            type: ActionType.SET_ERROR,
          });
      }
    }
  }, [synthetixAddresses, chainId, provider, address, dispatch]);

  useEffect(() => {
    fetchBalances();
    if (provider !== undefined) provider.on("block", fetchBalances);
    return () => {
      if (provider !== undefined) provider.off("block", fetchBalances);
    };
  }, [provider, fetchBalances]);

  return (
    <SynthetixContext.Provider value={state}>
      {children}
    </SynthetixContext.Provider>
  );
}

export default useSynthetix;